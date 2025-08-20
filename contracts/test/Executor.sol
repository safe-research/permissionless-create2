// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.29;

contract Executor {
    function execute(address to, bytes memory data) external returns (bool success, bytes memory result) {
        (success, result) = to.call(data);
    }
}
