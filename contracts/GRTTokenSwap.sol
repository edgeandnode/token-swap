// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title GRTTokenSwap
/// @notice A token swap contract that allows exchanging tokens minted by Arbitrum's standard GRT contract for the canonical GRT token
/// @notice Note that the inverse swap is not supported
/// @dev This contract needs to be topped off with enough canonical GRT to cover the swaps
contract GRTTokenSwap is Ownable {
    // -- State --

    /// The GRT token contract using the custom GRT gateway
    IERC20 public immutable canonicalGRT;
    /// The GRT token contract using Arbitrum's standard ERC20 gateway
    IERC20 public immutable standardGRT;

    // -- Events --
    event TokensSwapped(address indexed user, uint256 amount);
    event TokensTaken(address indexed owner, address indexed token, uint256 amount);

    // -- Errors --
    /// @dev Cannot process 0 tokens amounts
    error AmountMustBeGreaterThanZero();
    /// @dev Canonical and standard pair addresses are invalid. Either the same or one is 0x00
    error InvalidTokenAddressPair();
    /// @dev Token address not supported by this contract
    error InvalidTokenAddress();
    /// @dev The contract does not have enough canonical GRT tokens to cover the swap
    error ContractOutOfFunds();

    // -- Functions --
    /// @notice The constructor for the GRTTokenSwap contract
    constructor(IERC20 _canonicalGRT, IERC20 _standardGRT) {
        if (
            address(_canonicalGRT) == address(0) ||
            address(_standardGRT) == address(0) ||
            address(_canonicalGRT) == address(_standardGRT)
        ) revert InvalidTokenAddressPair();

        canonicalGRT = _canonicalGRT;
        standardGRT = _standardGRT;
    }

    /// @notice Swap standard GRT for canonical GRT
    /// @notice Ensure approve(_amount) is called on the standard GRT contract before calling this function
    /// @param _amount Amount of tokens to swap
    function swap(uint256 _amount) external {
        if (_amount == 0) revert AmountMustBeGreaterThanZero();

        uint256 balance = canonicalGRT.balanceOf(address(this));
        if (_amount > balance) revert ContractOutOfFunds();

        standardGRT.transferFrom(msg.sender, address(this), _amount);
        canonicalGRT.transfer(msg.sender, _amount);

        emit TokensSwapped(msg.sender, _amount);
    }

    /// @notice Get the token balances
    /// @return Balance of canonicalGRT and standardGRT
    function getTokenBalances() public view returns (uint256, uint256) {
        return (canonicalGRT.balanceOf(address(this)), standardGRT.balanceOf(address(this)));
    }

    /// @notice Transfer all tokens to the contract owner
    /// @dev This is a convenience function to clean up after the contract it's deemed to be no longer necessary
    function sweep() external onlyOwner {
        (uint canonicalBalance, uint standardBalance) = getTokenBalances();
        takeCanonical(canonicalBalance);
        takeStandard(standardBalance);
    }

    /// @notice Take standard tokens from the contract and send it to the owner
    /// @param _amount The amount of tokens to take
    function takeStandard(uint256 _amount) public onlyOwner {
        _take(standardGRT, _amount);
    }

    /// @notice Take canonical tokens from the contract and send it to the owner
    /// @param _amount The amount of tokens to take
    function takeCanonical(uint256 _amount) public onlyOwner {
        _take(canonicalGRT, _amount);
    }

    /// @notice Take tokens from the contract and send it to the owner
    /// @param _token The token to take
    /// @param _amount The amount of tokens to take
    function _take(IERC20 _token, uint256 _amount) private {
        if (_amount == 0) revert AmountMustBeGreaterThanZero();
        if (_token != canonicalGRT && _token != standardGRT) revert InvalidTokenAddress();
        _token.transfer(owner(), _amount);

        emit TokensTaken(msg.sender, address(_token), _amount);
    }
}
