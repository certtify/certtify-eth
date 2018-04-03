pragma solidity 0.4.18;

import "./CerttifyToken.sol";
import "./Ownable.sol";

/**
 * @title Certtify Token Bounty Contract
 * @author Ken Sze
 * 
 * @notice Bounty contract of Certtify token
 */
contract Bounty is Ownable {

    // Token to be distributed
    CerttifyToken public token;
    // Mapping for the amount of token waiting for withdrawal
    mapping(address => uint256) public bounties;
    // Whether withdrawl is already enabled
    bool public withdrawlEnabled = false;

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
     * @param _admin Admin of the Bounty which have permission to set the bounty for other addresses
     */
    function Bounty(CerttifyToken _token, address _admin) Ownable(_admin) public {
        token = _token;
    }

    /**
     * @notice Set the bounty rewarded to an array of address
     * @param beneficiaries Array of address to be rewarded
     * @param amounts Amount of tokens to reward to each address
     */
    function setBounties(address[] beneficiaries, uint256[] amounts) external onlyOwner {
        // Require the 2 array to be of equal length
        require(beneficiaries.length == amounts.length);
        // Set the bounty for each address
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            bounties[beneficiaries[i]] = amounts[i];
            BountySet(beneficiaries[i], amounts[i]);
        }
    }

    /**
     * @notice Enable withdrawl of bounty
     */
    function enableWithdrawl() external onlyOwner {
        withdrawlEnabled = true;
    }

    /**
     * @notice Withdraw the bounty rewarded to msg.sender
     */
    function withdrawBounty() public {
        // Require withdrawl to be enabled
        require(withdrawlEnabled);
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