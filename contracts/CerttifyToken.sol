pragma solidity 0.4.18;

import './zeppelin-solidity/StandardToken.sol';

/**
 * @title Certtify Token
 * @dev Contract of Certtify token
 * 
 * @dev The contract is composed of a StandardToken with a customized Burn function and event
 * @dev The customized burn function and event will be use in token conversion with Waves later on
 */
contract CerttifyToken is StandardToken {

    event Burn(address indexed burner, uint256 value, string wavesAddress);

    string public name = "Certtify Token";
    string public symbol = "CTF";
    uint8 public decimals = 18;

    address public deployer;
    bool public lockup = true; 

    function CerttifyToken(uint256 maxSupply) public {
        totalSupply = maxSupply.mul(10 ** uint256(decimals));
        balances[msg.sender] = totalSupply;
        deployer = msg.sender;
    }

    /**
     * Modifier for function that can only be executed after lock up period
     * During the lockup period, only contract deployer can execute those functions
     */
    modifier afterLockup() {
        require(!lockup || msg.sender == deployer);
        _;
    }

    /**
     * Remove the lock up of tokens, can only be called by contract deployer
     */
    function unlock() public {
        require(msg.sender == deployer);
        lockup = false;
    }

    /**
     * Impose lock up period on transfer() to block transfer of token during that period
     */
    function transfer(address _to, uint256 _value) public afterLockup() returns (bool) {
        return super.transfer(_to, _value);
    }

    /**
     * Impose lock up period on transferFrom() to block transfer of token during that period
     */
    function transferFrom(address _from, address _to, uint256 _value) public afterLockup() returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    /**
     * @dev Burns a specific amount of tokens, and optionally broadcasting a Waves address.
     * @param _value The amount of token to be burned.
     * @param _wavesAddress The Waves address where converted token should be sent to.
     */
    function burn(uint256 _value, string _wavesAddress) public afterLockup() {
        require(_value > 0);
        require(_value <= balances[msg.sender]);
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure
        address burner = msg.sender;
        // Burn!
        totalSupply = totalSupply.sub(_value);
        balances[burner] = balances[burner].sub(_value);
        // Log Burn event
        Burn(burner, _value, _wavesAddress);
    }

}