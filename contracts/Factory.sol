// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

/// @notice CREATE2 Deployment Factory
/// @dev The factory itself is implemented in EVM assembly (see 'Factory.evm')
///      and this library exports constants for use in Solidity.
library Factory {
    address internal constant DEPLOYER = 0x962560A0333190D57009A0aAAB7Bfa088f58461C;
    bytes32 internal constant SALT = hex"000000000000000000000000000000000000000000000000000000000001bec5";
    address internal constant ADDRESS = 0xC0DEb853af168215879d284cc8B4d0A645fA9b0E;

    bytes internal constant INITCODE = hex"7c60203d3d3582360380843d373d34f5806019573d813d933efd5b3d52f33d52601d6003f3";
    bytes internal constant RUNCODE = hex"60203d3d3582360380843d373d34f5806019573d813d933efd5b3d52f3";
    bytes32 internal constant CODEHASH = hex"2ad75e1e9642e6fce7d293d52fa5a8f62a79a2079abb7402256add02d6e8bc30";
}
