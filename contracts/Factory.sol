// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

/// @notice CREATE2 Deployment Factory
/// @dev The factory itself is implemented in EVM assembly (see 'Factory.evm')
///      and this library exports constants for use in Solidity.
library Factory {
    address internal constant DEPLOYER = 0x962560A0333190D57009A0aAAB7Bfa088f58461C;
    bytes32 internal constant SALT = hex"000000000000000000000000000000000000000000000000000000000019e078";
    address internal constant ADDRESS = 0xC0DE945918F144DcdF063469823a4C51152Df05D;

    bytes internal constant INITCODE = hex"7760203d3d3582360380843d373d34f580601457fd5b3d52f33d5260186008f3";
    bytes internal constant RUNCODE = hex"60203d3d3582360380843d373d34f580601457fd5b3d52f3";
    bytes32 internal constant CODEHASH = hex"eac13dde1a2c9b8dc8a7aded29ad0af5d57c811b746f7909ea841cbfc6ef3adc";
}
