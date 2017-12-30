pragma solidity 0.4.18;

import './CerttifyToken.sol';
import './math/SafeMath.sol';

/**
 * @title Certtify Token Crowdsale Contract
 * @author Ken Sze
 * 
 * @notice Crowdsale contract of Certtify token
 * @dev Developed based on zeppelin-solidity/contracts/crowdsale/Crowdsale.sol
 */
contract CerttifyCrowdsale {

    using SafeMath for uint256;

    // Token to be sold
    CerttifyToken public token;

    // Start timestamp of pre-sale
    uint256 public startTimeStage0;
    // Start timestamp of ICO phase 1
    uint256 public startTimeStage1;
    // Start timestamp of ICO phase 2
    uint256 public startTimeStage2;
    // Start timestamp of ICO phase 3
    uint256 public startTimeStage3;
    // End timestamp of ICO
    uint256 public endTime;

    // Address where ETH received is sent to;
    address public wallet;
    // Address of the contract owner
    address public contractOwner;

    // Number of token gets per wei received in ICO phase 1
    uint256 public rateStage1;
    // Number of token gets per wei received in ICO phase 2
    uint256 public rateStage2;
    // Number of token gets per wei received in ICO phase 3
    uint256 public rateStage3;

    // Maximum CTF token supply created
    uint256 public constant MAX_SUPPLY = 500000000;
    // Maximum CTF token supply created in decimals
    uint256 public MAX_SUPPLY_DECIMAL = MAX_SUPPLY.mul(10 ** uint256(18));
    // Maximum CTF token available in pre-sale, equates to 5% of total supply
    uint256 public MAX_ALLOWED_PRE_SALE = MAX_SUPPLY_DECIMAL.div(20);
    // Maximum CTF token available in ICO phase 1, equates to 20% of total supply
    uint256 public MAX_ALLOWED_STAGE_1 = MAX_SUPPLY_DECIMAL.div(5);
    // Maximum CTF token available in ICO phase 2, equates to 25% of total supply
    uint256 public MAX_ALLOWED_STAGE_2 = MAX_SUPPLY_DECIMAL.div(4);
    // Maximum CTF token available in ICO phase 3, equates to 25% of total supply
    uint256 public MAX_ALLOWED_STAGE_3 = MAX_SUPPLY_DECIMAL.div(4);
    // Maximum CTF token available BY ICO phase 1, equates to 25% of total supply
    uint256 public MAX_ALLOWED_BY_STAGE_1 = MAX_ALLOWED_PRE_SALE.add(MAX_ALLOWED_STAGE_1);
    // Maximum CTF token available BY ICO phase 2, equates to 50% of total supply
    uint256 public MAX_ALLOWED_BY_STAGE_2 = MAX_ALLOWED_BY_STAGE_1.add(MAX_ALLOWED_STAGE_2);
    // Maximum CTF token available BY ICO phase 3, equates to 75% of total supply
    uint256 public MAX_ALLOWED_TOTAL =  MAX_ALLOWED_BY_STAGE_2.add(MAX_ALLOWED_STAGE_3);

    // Amount of wei raised so far
    uint256 public weiRaised;
    // Amount of token sold
    uint256 public tokenSold;

    // Boolean storing whether ICO is ended with postICO() already called
    bool public icoEnded;
    
    // Timestamp when founders can begin withdrawing their token in phase 1
    uint256 public founderTokenUnlockPhase1;
    // Timestamp when founders can begin withdrawing their token in phase 2
    uint256 public founderTokenUnlockPhase2;
    // Timestamp when founders can begin withdrawing their token in phase 3
    uint256 public founderTokenUnlockPhase3;
    // Timestamp when founders can begin withdrawing their token in phase 4
    uint256 public founderTokenUnlockPhase4;

    // Boolean storing whether founders has withdrawn the token in phase 1 unlock
    bool public founderTokenWithdrawnPhase1;
    // Amount of token founders could withdraw in phase 1
    uint256 public founderWithdrawablePhase1;
    // Boolean storing whether founders has withdrawn the token in phase 2 unlock
    bool public founderTokenWithdrawnPhase2;
    // Amount of token founders could withdraw in phase 1
    uint256 public founderWithdrawablePhase2;
    // Boolean storing whether founders has withdrawn the token in phase 3 unlock
    bool public founderTokenWithdrawnPhase3;
    // Amount of token founders could withdraw in phase 3
    uint256 public founderWithdrawablePhase3;
    // Boolean storing whether founders has withdrawn the token in phase 4 unlock
    bool public founderTokenWithdrawnPhase4;
    // Amount of token founders could withdraw in phase 4
    uint256 public founderWithdrawablePhase4;

    /**
     * @notice Event for token purchase logging
     * @param purchaser who paid for the tokens
     * @param beneficiary who got the tokens
     * @param value weis paid for purchase
     * @param amount amount of tokens purchased
     */
    event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

    /**
     * @notice Fix for ERC20 short address attack
     * @param size Expected data size
     */
    modifier onlyPayloadSize(uint256 size) {
        require(msg.data.length >= size + 4);
        _;
    }

    /**
     * @notice Construct the crowdsale contact
     *
     * @param _timestampStage1 Timestamp in seconds since Unix epoch for stage 1 ICO to begin
     * @param _timestampStage2 Timestamp in seconds since Unix epoch for stage 2 ICO to begin
     * @param _timestampStage3 Timestamp in seconds since Unix epoch for stage 3 ICO to begin
     * @param _timestampEndTime Timestamp in seconds since Unix epoch for ending the ICO
     * @param _weiCostOfTokenStage1 Cost of each Certtify token, measured in wei, in stage 1 ICO
     * @param _weiCostOfTokenStage2 Cost of each Certtify token, measured in wei, in stage 2 ICO
     * @param _weiCostOfTokenStage3 Cost of each Certtify token, measured in wei, in stage 3 ICO
     * @param _wallet Address for collecting the raised fund
     * @param _founderTokenUnlockPhase1 Timestamp in seconds since Unix epoch for unlocking founders' token in phase 1
     * @param _founderTokenUnlockPhase2 Timestamp in seconds since Unix epoch for unlocking founders' token in phase 2
     * @param _founderTokenUnlockPhase3 Timestamp in seconds since Unix epoch for unlocking founders' token in phase 3
     * @param _founderTokenUnlockPhase4 Timestamp in seconds since Unix epoch for unlocking founders' token in phase 4
     */
    function CerttifyCrowdsale(
        uint256 _timestampStage1, uint256 _timestampStage2, uint256 _timestampStage3, uint256 _timestampEndTime, 
        uint256 _weiCostOfTokenStage1, uint256 _weiCostOfTokenStage2, uint256 _weiCostOfTokenStage3, 
        address _wallet, 
        uint256 _founderTokenUnlockPhase1, uint256 _founderTokenUnlockPhase2, uint256 _founderTokenUnlockPhase3, uint256 _founderTokenUnlockPhase4
    ) public {
        require(_timestampStage1 > 0);
        require(_timestampStage2 > 0);
        require(_timestampStage3 > 0);
        require(_timestampEndTime > 0);
        require(_weiCostOfTokenStage1 > 0);
        require(_weiCostOfTokenStage2 > 0);
        require(_weiCostOfTokenStage3 > 0);
        require(_wallet != address(0));
        require(_founderTokenUnlockPhase1 > 0);
        require(_founderTokenUnlockPhase2 > 0);
        require(_founderTokenUnlockPhase3 > 0);
        require(_founderTokenUnlockPhase4 > 0);

        // Create the Certtify token for sale
        token = createTokenContract();
        // Pre-sale can be done immediately after contract deployment
        startTimeStage0 = now;
        // Set the starting time for each stage
        startTimeStage1 = _timestampStage1;
        startTimeStage2 = _timestampStage2;
        startTimeStage3 = _timestampStage3;
        endTime = _timestampEndTime;
        // Calculate the rate for each stage
        rateStage1 = _weiCostOfTokenStage1;
        rateStage2 = _weiCostOfTokenStage2;
        rateStage3 = _weiCostOfTokenStage3;
        // Set Ethereum collection address
        wallet = _wallet;
        // Set contract owner
        contractOwner = msg.sender;
        // Set the time when founders' token are unlocked
        founderTokenUnlockPhase1 = _founderTokenUnlockPhase1;
        founderTokenUnlockPhase2 = _founderTokenUnlockPhase2;
        founderTokenUnlockPhase3 = _founderTokenUnlockPhase3;
        founderTokenUnlockPhase4 = _founderTokenUnlockPhase4;
    }

    /** 
     * @notice Creates the Certtify token to be sold
     * @return CerttifyToken Deployed CTF contract
     */
    function createTokenContract() internal returns (CerttifyToken) {
        return new CerttifyToken(MAX_SUPPLY);
    }

    /** 
     * @notice Fallback function can be used to buy tokens
     */
    function () external payable {
        buyTokens(msg.sender);
    }

    /**
     * @notice Function for handling buy token request
     * @param beneficiary Address of beneficiary
     */
    function buyTokens(address beneficiary) public payable {
        // Checking if purchase is valid
        require(beneficiary != address(0));
        require(validPurchase());
        // Calculate token amount to be created
        uint256 weiAmount = msg.value;
        uint256 tokens = weiAmount.div(getCurrentRate()).mul(10 ** uint256(18)); // Converting to token's decimal
        require(checkCapNotReached(tokens));
        // Update the amount of wei raised
        weiRaised = weiRaised.add(weiAmount);
        // Update the amount of token sold
        tokenSold = tokenSold.add(tokens);
        // Send fund to Ethereum collection address
        forwardFunds();
        // Rewarding buyer the token
        token.transfer(beneficiary, tokens);
        // Log the purchase event
        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);
    }

    /**
     * @notice Function for handling pre-sale
     * @param beneficiary Address of beneficiary
     * @param tokens Number of tokens to be sent
     */
    function buyTokensPreSale(address beneficiary, uint256 tokens) public onlyPayloadSize(2 * 32) {
        // Check if called by contract owner
        require(msg.sender == contractOwner);
        // Checking if the pre-sale is valid
        require(beneficiary != address(0));
        require(tokens > 0);
        require(tokenSold.add(tokens) <= MAX_ALLOWED_PRE_SALE);
        require(getCurrentStage() == 0);
        // Update the amount of token sold
        tokenSold = tokenSold.add(tokens);
        // Transfer token to buyer
        token.transfer(beneficiary, tokens);
        // Log the purchase event
        TokenPurchase(beneficiary, beneficiary, 0, tokens);
    }
    
    /**
     * @notice Function for contract owner to execute after the crowdsale
     * This function will,
     *      1. Set the amount of token withdrawable by founders which equates to 25% of all available token after withdrawl
     *      2. Burn all remaining tokens
     *      3. Remove the lock up on transfer() and transferFrom() on token contract
     */
    function postICO() public {
        // Check if called by contract owner
        require(msg.sender == contractOwner);
        // Check if ICO has ended
        require(hasEnded());
        // Check if this function is already called
        require(!icoEnded);
        // Calculate the amount of token founders will be able to withdraw
        // A total of 1/3 of all token sold, or 25% of all available token including these token, is withdrawable
        uint256 founderWithdrawableTotal = tokenSold.div(3);
        // 10% of total supply is withdrawable in phase 1 unlock (25% * 2/5 = 10%)
        // Used for supporting early adopters 
        founderWithdrawablePhase1 = founderWithdrawableTotal.mul(2).div(5);
        // 5% of total supply is withdrawable in phase 2, 3 and 4 unlock, each with 5% of total supply
        founderWithdrawablePhase2 = founderWithdrawableTotal.div(5);
        founderWithdrawablePhase3 = founderWithdrawableTotal.div(5);
        founderWithdrawablePhase4 = founderWithdrawableTotal.div(5);
        // End the ICO
        icoEnded = true;
        // Burn the remaining token if any
        uint256 tokenLeft = MAX_SUPPLY_DECIMAL.sub(tokenSold).sub(founderWithdrawableTotal);
        if (tokenLeft != 0) {
            token.burn(tokenLeft, "ICO_BURN_TOKEN_UNSOLD");
        }
        // Remove lock up
        token.unlock();
    }

    /**
     * @notice Allow founders to withdraw their token after lockup period
     */
    function founderWithdraw() public {
        // Check if called by contract owner
        require(msg.sender == contractOwner);
        // Check if postICO is already called, as it set the founderWithdrawable variable
        require(icoEnded);
        // If phase 4 has passed, all token is already withdrawn and there are no meaning going forward
        require(!founderTokenWithdrawnPhase4);
        if (!founderTokenWithdrawnPhase1) {
            // Withdraw token permissible in phase 1
            // Check if founders' token is unlocked
            require(now >= founderTokenUnlockPhase1);
            founderTokenWithdrawnPhase1 = true;
            // Send the withdrawable amount of token to contractOwner's address
            token.transfer(contractOwner, founderWithdrawablePhase1);
        } else if (!founderTokenWithdrawnPhase2) {
            // Withdraw token permissible in phase 2
            // Check if founders' token is unlocked
            require(now >= founderTokenUnlockPhase2);
            founderTokenWithdrawnPhase2 = true;
            // Send the withdrawable amount of token to contractOwner's address
            token.transfer(contractOwner, founderWithdrawablePhase2);
        } else if (!founderTokenWithdrawnPhase3) {
            // Withdraw token permissible in phase 3
            // Check if founders' token is unlocked
            require(now >= founderTokenUnlockPhase3);
            founderTokenWithdrawnPhase3 = true;
            // Send the withdrawable amount of token to contractOwner's address
            token.transfer(contractOwner, founderWithdrawablePhase3);
        } else {
            // Withdraw token permissible in phase 4
            // Check if founders' token is unlocked
            require(now >= founderTokenUnlockPhase4);
            founderTokenWithdrawnPhase4 = true;
            // Send the withdrawable amount of token to contractOwner's address
            token.transfer(contractOwner, founderWithdrawablePhase4);
        }
    }

    /**
     * @notice Send ether to fund collection address
     */
    function forwardFunds() internal {
        wallet.transfer(msg.value);
    }

    /** 
     * @notice Check if the purchase is valid
     * @return bool Returns true if the transaction can buy tokens
     */
    function validPurchase() internal view returns (bool) {
        // Purchase is within period as long as it is after stage 1 ICO and before ICO ends
        bool withinPeriod = now >= startTimeStage1 && now < endTime;
        // Check if the purchase is a zero purchase
        bool nonZeroPurchase = msg.value != 0;
        return withinPeriod && nonZeroPurchase;
    }

    /** 
     * @notice Check if the purchase request will lead to token sold beyond MAX_ALLOWED_TOTAL
     * @return bool Returns true if the purchase request can be entertained
     */
    function checkCapNotReached(uint256 tokenBuyReq) internal view returns (bool) {
        return tokenSold.add(tokenBuyReq) <= MAX_ALLOWED_TOTAL;
    }

    /**
     * @notice Calculate the current ICO stage
     * @return uint8 The current ICO stage of Certtify token, either 0, 1, 2, or 3
     */
    function getCurrentStage() internal view returns (uint8) {
        if (now < startTimeStage1) {
            return 0;
        } else if (now >= startTimeStage1 && now < startTimeStage2) {
            return 1;
        } else if (now >= startTimeStage2 && now < startTimeStage3) {
            return 2;
        } else {
            return 3;
        }
    }

    /**
     * @notice Calculate the current ICO rate based SOLELY on ICO stage
     * @return uint256 Current rate based SOLELY on ICO stage
     */
    function getCurrentRateByStage() internal view returns (uint256) {
        uint8 currentStage = getCurrentStage();
        // No need to assert currentStage != 0, since it would be blocked by validPurchase()
        if (currentStage == 1) {
            return rateStage1;
        } else if (currentStage == 2) {
            return rateStage2;
        } else {
            return rateStage3;
        }
    }

    /**
     * @notice Calculate the current ICO rate based SOLELY on amount of token sold
     * @dev For instance, if the amount token is beyond the cap of stage 1, but not stage 2, then rate of stage 2 is returned
     * @return uint256 Current rate based SOLELY on amount of token sold
     */
    function getCurrentRateByTokenSold() internal view returns (uint256) {
        if (tokenSold < MAX_ALLOWED_BY_STAGE_1) {
            return rateStage1;
        } else if (tokenSold < MAX_ALLOWED_BY_STAGE_2) {
            return rateStage2;
        } else {
            return rateStage3;
        }
    }
    
    /**
     * @notice Calculate the current ICO rate based on ICO stage and the amount of token sold
     * @return uint256 The current ICO rate
     */
    function getCurrentRate() internal view returns (uint256) {
        uint256 rateByStage = getCurrentRateByStage();
        uint256 rateByTokenSold = getCurrentRateByTokenSold();
        // Always return the one that result in larger rate (aka less bouns)
        if (rateByStage > rateByTokenSold) {
            return rateByStage;
        } else {
            return rateByTokenSold;
        }
    }

    /**
     * @notice Check if ICO has ended
     * @return bool Returns true if crowdsale event has ended
     */
    function hasEnded() public view returns (bool) {
        return now >= endTime || tokenSold >= MAX_ALLOWED_TOTAL;
    }

}