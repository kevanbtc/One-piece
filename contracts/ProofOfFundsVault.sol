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

contract ProofOfFundsVault is ERC721, EIP712, Ownable, ReentrancyGuard {
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
    }

    // EIP-712 typed data for off-chain bank/custody attestations
    // keccak256("Attestation(address account,address asset,uint256 amount,uint256 expiry,uint256 nonce)")
    bytes32 private constant ATTESTATION_TYPEHASH =
        keccak256("Attestation(address account,address asset,uint256 amount,uint256 expiry,uint256 nonce)");

    IAttesterRegistry public immutable attesters;
    uint256 public nextId = 1;
    mapping(uint256 => PoF) public proofs;      // tokenId => PoF
    mapping(uint256 => uint256) public escrow;  // tokenId => escrowed amount (if Mode.Escrow)
    mapping(address => uint256) public nonces;  // account => nonce for EIP-712 replay protection

    event Minted(uint256 indexed tokenId, address indexed owner, Mode mode, address asset, uint256 amount, uint256 expiry, address attester);
    event Burned(uint256 indexed tokenId);
    event Revoked(uint256 indexed tokenId, bool revoked);

    constructor(address attesterRegistry, address owner_)
        ERC721("ProofOfFunds", "PoF")
        EIP712("ProofOfFundsVault", "1")
        Ownable(owner_)
    {
        attesters = IAttesterRegistry(attesterRegistry);
    }

    // --------- Mint: ESCROW MODE (locks ERC-20) ----------
    function mintEscrow(address asset, uint256 amount, uint256 expiry) external nonReentrant returns (uint256 tokenId) {
        require(amount > 0, "amount=0");
        tokenId = nextId++;
        // pull funds
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        _safeMint(msg.sender, tokenId);
        proofs[tokenId] = PoF({
            mode: Mode.Escrow,
            asset: asset,
            amount: amount,
            issuedAt: block.timestamp,
            expiry: expiry,
            attester: address(0),
            revoked: false
        });
        escrow[tokenId] = amount;

        emit Minted(tokenId, msg.sender, Mode.Escrow, asset, amount, expiry, address(0));
    }

    // --------- Mint: ATTESTED MODE (bank/custody signed) ----------
    function mintAttested(
        address account,
        address asset,
        uint256 amount,
        uint256 expiry,
        uint8 v, bytes32 r, bytes32 s
    ) external returns (uint256 tokenId) {
        require(account == msg.sender, "mint to self");
        require(amount > 0, "amount=0");

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
            revoked: false
        });

        emit Minted(tokenId, account, Mode.Attested, asset, amount, expiry, signer);
    }

    // --------- Burn & Release (escrow) ----------
    function burn(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        PoF memory p = proofs[tokenId];
        _burn(tokenId);

        if (p.mode == Mode.Escrow) {
            uint256 locked = escrow[tokenId];
            escrow[tokenId] = 0;
            if (locked > 0) IERC20(p.asset).safeTransfer(msg.sender, locked);
        }
        delete proofs[tokenId];

        emit Burned(tokenId);
    }

    // --------- Admin revoke / un-revoke ----------
    function setRevoked(uint256 tokenId, bool value) external onlyOwner {
        require(_exists(tokenId), "no token");
        proofs[tokenId].revoked = value;
        emit Revoked(tokenId, value);
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

    // --------- tokenURI: on-chain JSON + SVG ----------
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "no token");
        PoF memory p = proofs[tokenId];

        string memory modeStr = p.mode == Mode.Escrow ? "Escrow" : "Attested";
        string memory amt = _fmtAmount(p.amount);
        string memory expiryStr = p.expiry == 0 ? "None" : _fmtTs(p.expiry);
        string memory issuedStr = _fmtTs(p.issuedAt);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="360">',
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
            '</svg>'
        );

        string memory json = string.concat(
            '{"name":"PoF #', tokenId.toString(), '","description":"Tamper-proof Proof-of-Funds NFT.",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Mode","value":"', modeStr, '"},',
            '{"trait_type":"Asset","value":"', _addr(p.asset), '"},',
            '{"trait_type":"Amount","value":"', amt, '"},',
            '{"trait_type":"Issued","value":"', issuedStr, '"},',
            '{"trait_type":"Expiry","value":"', expiryStr, '"},',
            p.mode == Mode.Attested
                ? string.concat('{"trait_type":"Attester","value":"', _addr(p.attester), '"}')
                : '{"trait_type":"Attester","value":"N/A"}',
            ']}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    // helpers
    function _fmtAmount(uint256 x) internal pure returns (string memory) {
        // raw integer (wallets will know decimals of asset)
        return x.toString();
    }
    function _fmtTs(uint256 t) internal pure returns (string memory) {
        return t.toString();
    }
    function _addr(address a) internal pure returns (string memory) {
        return Strings.toHexString(uint160(a), 20);
    }
}