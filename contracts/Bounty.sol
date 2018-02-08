pragma solidity 0.4.18;

import './CerttifyToken.sol';

/**
 * @title Certtify Token Bounty Contract
 * @author Ken Sze
 * 
 * @notice Bounty contract of Certtify token
 */
contract Bounty {

    // Token to be distributed
    CerttifyToken public token;
    // Mapping for the amount of token waiting for withdrawal
    mapping(address => uint256) public bounties;

    /**
     * @notice Event for setting the bounty for an address
     * @param beneficiary Recipent of the bounty
     * @param amount Amount of tokens received
     */
    event BountySet(address indexed beneficiary, uint256 amount);
    /**
     * @notice Event for withdrawing the bounty for an address
     * @param beneficiary Recipent of the bounty
     * @param amount Amount of tokens withdrawn
     */
    event BountyWithdraw(address indexed beneficiary, uint256 amount);

    /**
     * @notice Instantiate the Bounty contract
     * @param _token CerttifyToken contract
     */
    function Bounty(CerttifyToken _token) public {
        token = _token;
    }

    /**
     * @notice Set the bounty rewarded to an array of address
     * @param beneficiaries Array of address to be rewarded
     * @param amounts Amount of tokens to reward to each address
     */
    function setBounties(address[] beneficiaries, uint256[] amounts) external {
        // Require the 2 array to be of equal length
        require(beneficiaries.length == amounts.length);
        // Set the bounty for each address
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            bounties[beneficiaries[i]] = amounts[i];
            BountySet(beneficiaries[i], amounts[i]);
        }
    }

    /**
     * @notice Withdraw the bounty rewarded to msg.sender
     */
    function withdrawBounty() public {
        // Require the withdrawable bounty for msg.sender to be greater than 0
        require(bounties[msg.sender] > 0);
        // Temporarily store the bounty withdrawable for msg.sender
        uint256 bountyWithdrawn = bounties[msg.sender];
        // Set bounties to 0
        bounties[msg.sender] = 0;
        // Log the withdraw event
        BountyWithdraw(msg.sender, bountyWithdrawn);
        // Transfer the token
        token.transfer(msg.sender, bountyWithdrawn);
    }

    /** 
     * @notice Fallback function can be used to withdraw bounty token
     */
    function () external {
        withdrawBounty();
    }

}