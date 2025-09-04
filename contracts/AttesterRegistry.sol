// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AttesterRegistry is Ownable {
    mapping(address => bool) public isAttester;

    event AttesterSet(address indexed attester, bool allowed);

    constructor(address owner_) Ownable(owner_) {}

    function setAttester(address attester, bool allowed) external onlyOwner {
        isAttester[attester] = allowed;
        emit AttesterSet(attester, allowed);
    }
}