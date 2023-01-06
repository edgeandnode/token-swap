// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title GRTTokenSwap
/// @notice A token swap contract that allows exchanging tokens minted by Arbitrum's standard GRT contract for the canonical GRT token
/// @notice Note that the inverse swap is not supported
/// @dev This contract needs to be topped off with enough canonical GRT to cover the swaps
contract GRTTokenSwap {
    // -- State --

    /// The GRT token contract using the custom GRT gateway
    IERC20 public immutable canonicalGRT;

    /// The GRT token contract using Arbitrum's standard ERC20 gateway
    IERC20 public immutable standardGRT;

    /// The owner of the contract
    address public owner;

    // -- Events --
    event OwnerSet(address indexed owner);

    // -- Errors --
    error AmountMustBeGreaterThanZero();
    error OwnerCannotBeZeroAddress();
    error SenderNotAuthorized();

    /// @dev Canonical and standard token addresses can't be the same
    error TokensCannotMatch();

    /// @dev The token is not supported by this contract
    error InvalidToken();

    /// @dev The contract does not have enough canonical GRT tokens to cover the swap
    error ContractOutOfFunds();

    // -- Modifiers --

    modifier onlyOwner() {
        if (msg.sender != owner) revert SenderNotAuthorized();
        _;
    }

    // -- Functions --

    constructor(address _owner, IERC20 _canonicalGRT, IERC20 _standardGRT) {
        if (_canonicalGRT == _standardGRT) revert TokensCannotMatch();
        canonicalGRT = _canonicalGRT;
        standardGRT = _standardGRT;
        _setOwner(_owner);
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
    }

    /// @notice Get the token balances
    /// @return Balance of canonicalGRT and standardGRT
    function getTokenBalances() external view returns (uint256, uint256) {
        return (canonicalGRT.balanceOf(address(this)), standardGRT.balanceOf(address(this)));
    }

    /// @notice Transfer all tokens to the contract owner
    /// @dev This is a convenience function to clean up after the contract it's deem to be no longer necessary
    function sweep() external onlyOwner {
        take(canonicalGRT, canonicalGRT.balanceOf(address(this)));
        take(standardGRT, standardGRT.balanceOf(address(this)));
    }

    /// @notice Take tokens from the contract
    /// @param _token The token to take
    /// @param _amount The amount of tokens to take
    function take(IERC20 _token, uint256 _amount) public onlyOwner {
        if (_amount == 0) revert AmountMustBeGreaterThanZero();
        if (_token != canonicalGRT && _token != standardGRT) revert InvalidToken();
        _token.transfer(owner, _amount);
    }

    /// @notice Set the owner of the contract
    /// @param _owner The address of the new owner
    function setOwner(address _owner) external onlyOwner {
        _setOwner(_owner);
    }

    /// @dev Set the owner of the contract
    /// @param _owner The address of the new owner
    function _setOwner(address _owner) private {
        if (_owner == address(0)) revert OwnerCannotBeZeroAddress();
        owner = _owner;
        emit OwnerSet(owner);
    }
}
