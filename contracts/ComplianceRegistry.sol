// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ComplianceRegistry is Ownable {
    struct Provider {
        bool allowed;
        string name;
        string infoURI; // terms, docs
    }

    // KYC / KYB providers allowed to issue compliance references
    mapping(address => Provider) public kycProviders;

    // versioned sanctions datasets (e.g., OFAC SDN 2025-09-01)
    mapping(bytes32 => bool) public sanctionsVersions; // keccak256("OFAC:2025-09-01")

    event KYCProviderSet(address indexed provider, bool allowed, string name, string infoURI);
    event SanctionsVersionSet(bytes32 indexed versionHash, bool allowed);

    constructor(address owner_) Ownable(owner_) {}

    function setKYCProvider(address provider, bool allowed, string calldata name, string calldata infoURI) external onlyOwner {
        kycProviders[provider] = Provider({allowed: allowed, name: name, infoURI: infoURI});
        emit KYCProviderSet(provider, allowed, name, infoURI);
    }

    function setSanctionsVersion(bytes32 versionHash, bool allowed) external onlyOwner {
        sanctionsVersions[versionHash] = allowed;
        emit SanctionsVersionSet(versionHash, allowed);
    }

    function isAllowedProvider(address p) external view returns (bool) { 
        return kycProviders[p].allowed; 
    }
    
    function isAllowedSanctions(bytes32 v) external view returns (bool) { 
        return sanctionsVersions[v]; 
    }
}