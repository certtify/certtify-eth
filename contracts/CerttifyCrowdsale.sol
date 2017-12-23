pragma solidity 0.4.18;

import './CerttifyToken.sol';
import './math/SafeMath.sol';

/**
 * @title Certtify Token Crowdsale Contract
 * 
 * @dev Crowdsale contract of Certtify token
 * @dev Developed based on zeppelin-solidity/contracts/crowdsale/Crowdsale.sol
 */
contract CerttifyCrowdsale {

    using SafeMath for uint256;

    // Token to be sold
    CerttifyToken public token;

    // Start and end timestamps when crowdsale and stage is opened
    uint256 public startTimeStage0;
    uint256 public startTimeStage1;
    uint256 public startTimeStage2;
    uint256 public startTimeStage3;
    uint256 public endTime;

    // Address where ETH received is sent to;
    address public wallet;
    // Address of the contract owner
    address public contractOwner;

    // Number of token gets per wei received in each crowdsale stage
    uint256 public rateStage1;
    uint256 public rateStage2;
    uint256 public rateStage3;

    // Cap of the crowdsale
    uint256 public constant MAX_SUPPLY = 500000000; // 5e8
    uint256 public MAX_SUPPLY_DECIMAL = MAX_SUPPLY.mul(10 ** uint256(18)); // MAX_SUPPLY in decimal form
    uint256 public MAX_ALLOWED_PRE_SALE = MAX_SUPPLY_DECIMAL.div(20); // 5% of MAX_SUPPLY
    uint256 public MAX_ALLOWED_STAGE_1 = MAX_SUPPLY_DECIMAL.div(5); // 20% of MAX_SUPPLY
    uint256 public MAX_ALLOWED_STAGE_2 = MAX_SUPPLY_DECIMAL.div(4); // 25% of MAX_SUPPLY
    uint256 public MAX_ALLOWED_STAGE_3 = MAX_SUPPLY_DECIMAL.div(4); // 25% of MAX_SUPPLY
    uint256 public MAX_ALLOWED_BY_STAGE_1 = MAX_ALLOWED_PRE_SALE.add(MAX_ALLOWED_STAGE_1); // 25% of MAX_SUPPLY
    uint256 public MAX_ALLOWED_BY_STAGE_2 = MAX_ALLOWED_BY_STAGE_1.add(MAX_ALLOWED_STAGE_2); // 50% of MAX_SUPPLY
    uint256 public MAX_ALLOWED_TOTAL =  MAX_ALLOWED_BY_STAGE_2.add(MAX_ALLOWED_STAGE_3); // 75% of MAX_SUPPLY

    // Amount of wei raised so far
    uint256 public weiRaised;
    // Amount of token sold
    uint256 public tokenSold;

    // Boolean storing whether ICO is ended with postICO() already called
    bool public icoEnded;

    /**
    * Event for token purchase logging
    * @param purchaser who paid for the tokens
    * @param beneficiary who got the tokens
    * @param value weis paid for purchase
    * @param amount amount of tokens purchased
    */
    event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

    /**
     * Construct the crowdsale contact
     *
     * @param _timestampStage1 Timestamp in seconds since Unix epoch for stage 1 ICO to begin
     * @param _timestampStage2 Number of seconds after the launch of stage 1 ICO for stage 2 ICO to begin
     * @param _timestampStage3 Number of seconds after the launch of stage 2 ICO for stage 3 ICO to begin
     * @param _timestampEndTime Number of seconds after the launch of stage 3 ICO for ending the ICO
     * @param _szaboCostOfTokenStage1 Cost of each Certtify token, measured in szabo, in stage 1 ICO
     * @param _szaboCostOfTokenStage2 Cost of each Certtify token, measured in szabo, in stage 2 ICO
     * @param _szaboCostOfTokenStage3 Cost of each Certtify token, measured in szabo, in stage 3 ICO
     * @param _wallet Address for collecting the raised fund
     */
    function CerttifyCrowdsale(
        uint256 _timestampStage1, uint256 _timestampStage2, uint256 _timestampStage3, uint256 _timestampEndTime, 
        uint256 _szaboCostOfTokenStage1, uint256 _szaboCostOfTokenStage2, uint256 _szaboCostOfTokenStage3, 
        address _wallet 
    ) public {
        require(_timestampStage1 > 0);
        require(_timestampStage2 > 0);
        require(_timestampStage3 > 0);
        require(_timestampEndTime > 0);
        require(_szaboCostOfTokenStage1 > 0);
        require(_szaboCostOfTokenStage2 > 0);
        require(_szaboCostOfTokenStage3 > 0);
        require(_wallet != address(0));

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
        rateStage1 = _szaboCostOfTokenStage1.mul(1 szabo);
        rateStage2 = _szaboCostOfTokenStage2.mul(1 szabo);
        rateStage3 = _szaboCostOfTokenStage3.mul(1 szabo);
        // Set Ethereum collection address
        wallet = _wallet;
        // Set contract owner
        contractOwner = msg.sender;
        // Set ICO not ended
        icoEnded = false;
    }

    /** 
     * Creates the Certtify token to be sold
     */
    function createTokenContract() internal returns (CerttifyToken) {
        return new CerttifyToken(MAX_SUPPLY);
    }

    /** 
     * Fallback function can be used to buy tokens
     */
    function () external payable {
        buyTokens(msg.sender);
    }

    /**
     * Function for handling buy token request
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
        // Rewarding buyer the token
        token.transfer(beneficiary, tokens);
        // Log the purchase event
        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);
        // Send fund to Ethereum collection address
        forwardFunds();
    }

    /**
     * Function for handling pre-sale
     */
    function buyTokensPreSale(address beneficiary, uint256 tokens) public {
        // Check if called by contract owner
        require(msg.sender == contractOwner);
        // Checking if the pre-sale is valid
        require(beneficiary != address(0));
        require(tokens > 0);
        require(tokenSold.add(tokens) <= MAX_ALLOWED_PRE_SALE);
        require(getCurrentStage() == 0);
        // Transfer token to buyer
        token.transfer(beneficiary, tokens);
        // Update the amount of token sold
        tokenSold = tokenSold.add(tokens);
        // Log the purchase event
        TokenPurchase(beneficiary, beneficiary, 0, tokens);
    }
    
    /**
     * Function for contract owner to execute after the crowdsale
     * 
     * This function will,
     *      1. Allow contract owner to withdraw, on behalf of all co-founder, to extract tokens that equates to 25% of all available token after withdrawl
     *      2. Burn all remaining tokens
     */
    function postICO() public {
        // Check if called by contract owner
        require(msg.sender == contractOwner);
        // Check if ICO has ended
        require(hasEnded());
        // Check if this function is already called
        require(!icoEnded);
        // Calculate the amount of token founders will be able to withdraw
        uint256 tokenWithdraw = tokenSold.div(3); // 1/3 of all token sold ==> 25% of all available token including these token
        token.transfer(contractOwner, tokenWithdraw);
        // Burn the remaining token if any
        uint256 tokenLeft = MAX_SUPPLY_DECIMAL.sub(tokenSold).sub(tokenWithdraw);
        if (tokenLeft != 0) {
            token.burn(tokenLeft, "NOTE:ICO_BURN_LEFT");
        }
        // End the ICO
        icoEnded = true;
    }

    /**
     * Send ether to fund collection address
     */
    function forwardFunds() internal {
        wallet.transfer(msg.value);
    }

    /** 
     * Check if the purchase is valid
     *
     * @return true if the transaction can buy tokens
     */
    function validPurchase() internal view returns (bool) {
        // Purchase is within period as long as it is after stage 1 ICO and before ICO ends
        bool withinPeriod = now >= startTimeStage1 && now < endTime;
        // Check if the purchase is a zero purchase
        bool nonZeroPurchase = msg.value != 0;
        return withinPeriod && nonZeroPurchase;
    }

    /** 
     * Check if the purchase request will lead to token sold beyond MAX_ALLOWED_TOTAL
     *
     * @return true if the purchase request can be entertained
     */
    function checkCapNotReached(uint256 tokenBuyReq) internal view returns (bool) {
        return tokenSold.add(tokenBuyReq) <= MAX_ALLOWED_TOTAL;
    }

    /**
     * Calculate the current ICO stage
     *
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
     * Calculate the current ICO rate based SOLELY on ICO stage
     *
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
     * Calculate the current ICO rate based SOLELY on amount of token sold
     * For instance, if the amount token is beyond the cap of stage 1, but not stage 2, then rate of stage 2 is returned
     *
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
     * Calculate the current ICO rate based on ICO stage and the amount of token sold
     *
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
     * @return true if crowdsale event has ended
     */
    function hasEnded() public view returns (bool) {
        return now >= endTime || tokenSold >= MAX_ALLOWED_TOTAL;
    }

}