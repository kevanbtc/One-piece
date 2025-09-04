// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

interface IAttesterRegistry {
    function isAttester(address) external view returns (bool);
}

interface IComplianceRegistry {
    function isAllowedProvider(address) external view returns (bool);
    function isAllowedSanctions(bytes32) external view returns (bool);
}

contract ProofOfFundsVaultV2 is ERC721, EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Strings for uint256;
    using Strings for address;

    enum Mode { Escrow, Attested }

    struct PoF {
        Mode mode;
        address asset;     // ERC-20 in escrow OR referenced asset
        uint256 amount;    // wei units of asset (e.g., USDC 6d)
        uint256 issuedAt;  // block.timestamp
        uint256 expiry;    // 0 = no expiry
        address attester;  // for Attested mode
        bool revoked;

        // NEW — Compliance + IP + Uniqueness
        address kycProvider;        // must be allowed in ComplianceRegistry
        bytes32 kycRef;             // e.g., hash of KYC/KYB ticket
        bytes32 sanctionsVersion;   // e.g., keccak256("OFAC:2025-09-01")
        string  compliancePackCID;  // IPFS CID of signed compliance PDF/JSON
        bytes32 licenseHash;        // intellectual property/license doc hash
        bytes32 uniqueKey;          // prevents duplicates while active
    }

    // EIP-712 typed data for off-chain bank/custody attestations
    // keccak256("Attestation(address account,address asset,uint256 amount,uint256 expiry,uint256 nonce)")
    bytes32 private constant ATTESTATION_TYPEHASH =
        keccak256("Attestation(address account,address asset,uint256 amount,uint256 expiry,uint256 nonce)");

    IAttesterRegistry public immutable attesters;
    IComplianceRegistry public immutable compliance; // NEW

    bool public soulbound; // NEW: when true, disable transfers

    uint256 public nextId = 1;
    mapping(uint256 => PoF) public proofs;      // tokenId => PoF
    mapping(uint256 => uint256) public escrow;  // tokenId => escrowed amount (if Mode.Escrow)
    mapping(address => uint256) public nonces;  // account => nonce for EIP-712 replay protection
    mapping(bytes32 => bool) public uniqueKeyActive; // NEW

    event Minted(uint256 indexed tokenId, address indexed owner, Mode mode, address asset, uint256 amount, uint256 expiry, address attester);
    event Burned(uint256 indexed tokenId);
    event Revoked(uint256 indexed tokenId, bool revoked);
    event ComplianceAttached(uint256 indexed tokenId, address indexed kycProvider, bytes32 kycRef, bytes32 sanctionsVersion, string compliancePackCID, bytes32 licenseHash, bytes32 uniqueKey);
    event ClientIPObserved(uint256 indexed tokenId, bytes32 clientIpHash); // IP (internet protocol) privacy-safe

    constructor(address attesterRegistry, address complianceRegistry, address owner_)
        ERC721("ProofOfFunds", "PoF")
        EIP712("ProofOfFundsVault", "1")
        Ownable(owner_)
    {
        attesters  = IAttesterRegistry(attesterRegistry);
        compliance = IComplianceRegistry(complianceRegistry);
    }

    // —— ADMIN: toggle soulbound ——
    function setSoulbound(bool value) external onlyOwner { 
        soulbound = value; 
    }

    // —— Uniqueness guard ——
    function _reserveUnique(bytes32 key) internal {
        if (key != bytes32(0)) {
            require(!uniqueKeyActive[key], "UNIQUE_KEY_ACTIVE");
            uniqueKeyActive[key] = true;
        }
    }
    
    function _releaseUnique(bytes32 key) internal {
        if (key != bytes32(0)) uniqueKeyActive[key] = false;
    }

    // —— Overload mint funcs to accept compliance args ——
    function mintEscrow(
        address asset, uint256 amount, uint256 expiry,
        // NEW compliance/IP
        address kycProvider, bytes32 kycRef, bytes32 sanctionsVersion, 
        string calldata compliancePackCID, bytes32 licenseHash, bytes32 uniqueKey
    ) external nonReentrant returns (uint256 tokenId) {
        require(amount > 0, "amount=0");
        if (kycProvider != address(0)) require(compliance.isAllowedProvider(kycProvider), "KYC_PROVIDER_NOT_ALLOWED");
        if (sanctionsVersion != bytes32(0)) require(compliance.isAllowedSanctions(sanctionsVersion), "SANCTIONS_VER_NOT_ALLOWED");

        _reserveUnique(uniqueKey);

        tokenId = nextId++;
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _safeMint(msg.sender, tokenId);

        proofs[tokenId] = PoF({
            mode: Mode.Escrow,
            asset: asset,
            amount: amount,
            issuedAt: block.timestamp,
            expiry: expiry,
            attester: address(0),
            revoked: false,
            kycProvider: kycProvider,
            kycRef: kycRef,
            sanctionsVersion: sanctionsVersion,
            compliancePackCID: compliancePackCID,
            licenseHash: licenseHash,
            uniqueKey: uniqueKey
        });
        escrow[tokenId] = amount;

        emit Minted(tokenId, msg.sender, Mode.Escrow, asset, amount, expiry, address(0));
        emit ComplianceAttached(tokenId, kycProvider, kycRef, sanctionsVersion, compliancePackCID, licenseHash, uniqueKey);
    }

    function mintAttested(
        address account, address asset, uint256 amount, uint256 expiry,
        uint8 v, bytes32 r, bytes32 s,
        // NEW compliance/IP
        address kycProvider, bytes32 kycRef, bytes32 sanctionsVersion, 
        string calldata compliancePackCID, bytes32 licenseHash, bytes32 uniqueKey
    ) external returns (uint256 tokenId) {
        require(account == msg.sender, "mint to self");
        require(amount > 0, "amount=0");
        if (kycProvider != address(0)) require(compliance.isAllowedProvider(kycProvider), "KYC_PROVIDER_NOT_ALLOWED");
        if (sanctionsVersion != bytes32(0)) require(compliance.isAllowedSanctions(sanctionsVersion), "SANCTIONS_VER_NOT_ALLOWED");

        _reserveUnique(uniqueKey);

        // EIP712 verification
        uint256 nonce = nonces[account]++;
        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH, account, asset, amount, expiry, nonce
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        require(attesters.isAttester(signer), "invalid attester");

        tokenId = nextId++;
        _safeMint(account, tokenId);
        proofs[tokenId] = PoF({
            mode: Mode.Attested,
            asset: asset,
            amount: amount,
            issuedAt: block.timestamp,
            expiry: expiry,
            attester: signer,
            revoked: false,
            kycProvider: kycProvider,
            kycRef: kycRef,
            sanctionsVersion: sanctionsVersion,
            compliancePackCID: compliancePackCID,
            licenseHash: licenseHash,
            uniqueKey: uniqueKey
        });

        emit Minted(tokenId, account, Mode.Attested, asset, amount, expiry, signer);
        emit ComplianceAttached(tokenId, kycProvider, kycRef, sanctionsVersion, compliancePackCID, licenseHash, uniqueKey);
    }

    // —— Burn / Revoke release uniqueKey ——
    function burn(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        PoF memory p = proofs[tokenId];
        _burn(tokenId);
        if (p.mode == Mode.Escrow) {
            uint256 locked = escrow[tokenId];
            escrow[tokenId] = 0;
            if (locked > 0) IERC20(p.asset).safeTransfer(msg.sender, locked);
        }
        _releaseUnique(p.uniqueKey);
        delete proofs[tokenId];
        emit Burned(tokenId);
    }

    function setRevoked(uint256 tokenId, bool value) external onlyOwner {
        require(_exists(tokenId), "no token");
        proofs[tokenId].revoked = value;
        if (value) _releaseUnique(proofs[tokenId].uniqueKey);
        emit Revoked(tokenId, value);
    }

    // —— Soulbound guard ——
    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address)
    {
        if (soulbound && auth != address(0) && to != address(0)) {
            // disallow transfers (mint/burn allowed)
            require(auth == address(0), "SOULBOUND");
        }
        return super._update(to, tokenId, auth);
    }

    // —— IP (internet protocol) audit hook ——
    function recordClientIp(uint256 tokenId, bytes32 clientIpHash) external {
        require(_exists(tokenId), "no token");
        emit ClientIPObserved(tokenId, clientIpHash);
    }

    // --------- Read: verify ----------
    function verify(uint256 tokenId, address requiredAsset, uint256 minAmount) external view returns (bool valid, string memory reason) {
        if (!_exists(tokenId)) return (false, "TOKEN_NOT_FOUND");
        PoF memory p = proofs[tokenId];

        if (p.revoked) return (false, "REVOKED");
        if (requiredAsset != address(0) && p.asset != requiredAsset) return (false, "ASSET_MISMATCH");
        if (p.expiry != 0 && block.timestamp > p.expiry) return (false, "EXPIRED");

        if (p.mode == Mode.Escrow) {
            uint256 locked = escrow[tokenId];
            if (locked < minAmount) return (false, "INSUFFICIENT_ESCROW");
        } else {
            if (!IAttesterRegistry(address(attesters)).isAttester(p.attester)) return (false, "ATTESTER_NOT_ALLOWED");
            if (p.amount < minAmount) return (false, "INSUFFICIENT_ATTESTED");
        }
        return (true, "OK");
    }

    // --------- tokenURI: on-chain JSON + SVG with compliance ----------
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "no token");
        PoF memory p = proofs[tokenId];

        string memory modeStr = p.mode == Mode.Escrow ? "Escrow" : "Attested";
        string memory amt = _fmtAmount(p.amount);
        string memory expiryStr = p.expiry == 0 ? "None" : _fmtTs(p.expiry);
        string memory issuedStr = _fmtTs(p.issuedAt);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="420">',
            '<rect width="100%" height="100%" fill="#0b0f19"/>',
            '<text x="30" y="60" font-size="28" fill="#e2e8f0" font-family="monospace">Proof of Funds</text>',
            '<text x="30" y="110" font-size="16" fill="#a3b1c6" font-family="monospace">Mode: ', modeStr, '</text>',
            '<text x="30" y="140" font-size="16" fill="#a3b1c6" font-family="monospace">Asset: ', _addr(p.asset), '</text>',
            '<text x="30" y="170" font-size="16" fill="#a3b1c6" font-family="monospace">Amount: ', amt, '</text>',
            '<text x="30" y="200" font-size="16" fill="#a3b1c6" font-family="monospace">Issued: ', issuedStr, '</text>',
            '<text x="30" y="230" font-size="16" fill="#a3b1c6" font-family="monospace">Expiry: ', expiryStr, '</text>',
            p.mode == Mode.Attested
                ? string.concat('<text x="30" y="260" font-size="16" fill="#a3b1c6" font-family="monospace">Attester: ', _addr(p.attester), '</text>')
                : '<text x="30" y="260" font-size="16" fill="#a3b1c6" font-family="monospace">Escrowed on-chain</text>',
            p.kycProvider != address(0) 
                ? string.concat('<text x="30" y="290" font-size="14" fill="#22c55e" font-family="monospace">KYC: ', _addr(p.kycProvider), '</text>')
                : '<text x="30" y="290" font-size="14" fill="#6b7280" font-family="monospace">No KYC</text>',
            bytes(p.compliancePackCID).length > 0
                ? '<text x="30" y="320" font-size="14" fill="#22c55e" font-family="monospace">Compliance: Verified</text>'
                : '<text x="30" y="320" font-size="14" fill="#6b7280" font-family="monospace">No Compliance Pack</text>',
            p.licenseHash != bytes32(0)
                ? '<text x="30" y="350" font-size="14" fill="#3b82f6" font-family="monospace">Licensed</text>'
                : '',
            '</svg>'
        );

        string memory json = string.concat(
            '{"name":"PoF #', tokenId.toString(), '","description":"Enterprise-grade Proof-of-Funds NFT with KYC/AML compliance.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Mode","value":"', modeStr, '"},',
            '{"trait_type":"Asset","value":"', _addr(p.asset), '"},',
            '{"trait_type":"Amount","value":"', amt, '"},',
            '{"trait_type":"Issued","value":"', issuedStr, '"},',
            '{"trait_type":"Expiry","value":"', expiryStr, '"},',
            p.mode == Mode.Attested
                ? string.concat('{"trait_type":"Attester","value":"', _addr(p.attester), '"},')
                : '{"trait_type":"Attester","value":"N/A"},',
            p.kycProvider != address(0)
                ? string.concat('{"trait_type":"KYC Provider","value":"', _addr(p.kycProvider), '"},')
                : '{"trait_type":"KYC Provider","value":"None"},',
            bytes(p.compliancePackCID).length > 0
                ? string.concat('{"trait_type":"Compliance Pack","value":"', p.compliancePackCID, '"},')
                : '{"trait_type":"Compliance Pack","value":"None"},',
            p.licenseHash != bytes32(0)
                ? string.concat('{"trait_type":"License Hash","value":"', _bytes32ToString(p.licenseHash), '"}')
                : '{"trait_type":"License Hash","value":"None"}',
            ']}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    // helpers
    function _fmtAmount(uint256 x) internal pure returns (string memory) {
        return x.toString();
    }
    function _fmtTs(uint256 t) internal pure returns (string memory) {
        return t.toString();
    }
    function _addr(address a) internal pure returns (string memory) {
        return Strings.toHexString(uint160(a), 20);
    }
    function _bytes32ToString(bytes32 _bytes32) internal pure returns (string memory) {
        return Strings.toHexString(uint256(_bytes32), 32);
    }

    // Legacy support - simple mint functions without compliance
    function mintEscrow(address asset, uint256 amount, uint256 expiry) external nonReentrant returns (uint256 tokenId) {
        return mintEscrow(asset, amount, expiry, address(0), bytes32(0), bytes32(0), "", bytes32(0), bytes32(0));
    }

    function mintAttested(
        address account, address asset, uint256 amount, uint256 expiry,
        uint8 v, bytes32 r, bytes32 s
    ) external returns (uint256 tokenId) {
        return mintAttested(account, asset, amount, expiry, v, r, s, address(0), bytes32(0), bytes32(0), "", bytes32(0), bytes32(0));
    }
}