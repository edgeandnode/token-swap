// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title TokenSwap
/// A simple token swap contract that allows swapping between two ERC20 tokens.
contract TokenSwap {
    // -- State --

    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    address public owner;

    // -- Events --

    event OwnerSet(address indexed owner);

    // -- Modifiers --

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    // -- Functions --

    constructor(address _owner, IERC20 _tokenA, IERC20 _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
        _setOwner(_owner);
    }

    /// @notice Get the token balances
    /// @return Balance of tokenA and tokenB
    function getTokenBalances() external view returns (uint256, uint256) {
        return (tokenA.balanceOf(address(this)), tokenB.balanceOf(address(this)));
    }

    /// @notice Set the owner of the contract
    /// @param _owner The address of the new owner
    function setOwner(address _owner) external onlyOwner {
        _setOwner(_owner);
    }

    /// @notice Withdraw all tokens
    function sweep() external onlyOwner {
        tokenA.transfer(owner, tokenA.balanceOf(address(this)));
        tokenB.transfer(owner, tokenB.balanceOf(address(this)));
    }

    /// @notice Take tokens from the contract
    function take(IERC20 _token, uint256 _amount) external onlyOwner {
        require(_amount > 0, "Amount must be greater than zero");
        require(_token == tokenA || _token == tokenB, "Invalid token");
        _token.transfer(owner, _amount);
    }

    /// @notice Swap tokens
    /// @param _amount Amount of token A to swap
    function swap(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than zero");
        tokenA.transferFrom(msg.sender, address(this), _amount);
        tokenB.transfer(msg.sender, _amount);
    }

    /// @dev Set the owner of the contract
    /// @param _owner The address of the new owner
    function _setOwner(address _owner) private {
        require(_owner != address(0), "Owner cannot be zero address");
        owner = _owner;
        emit OwnerSet(owner);
    }
}
