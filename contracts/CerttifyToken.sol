pragma solidity 0.4.21;

import "./zeppelin-solidity/StandardToken.sol";

/**
 * @title Certtify Token
 * @author Ken Sze
 * @notice Contract of Certtify token
 * 
 * @dev The contract is composed of a StandardToken with a customized Burn and CertIssue function and event
 * @dev The customized function and event will be use in token burnt after ICO and in issuing certificate
 */
contract CerttifyToken is StandardToken {

    /**
     * @notice Event for token burn
     * @param burner Address of the token burner
     * @param value Number of tokens burnt
     * @param message Additional message by the burner
     */
    event Burn(address indexed burner, uint256 value, string message);
    /**
     * @notice Event for issuing certificate
     * @param id Certificate ID
     * @param certIssuer Address of the certificate issuer
     * @param value Number of tokens burnt
     * @param cert Certificate
     */
    event IssueCert(bytes32 indexed id, address certIssuer, uint256 value, bytes cert);

    // Name of the token
    string public name = "Certtify Token";
    // Symbol of the token
    string public symbol = "CTF";
    // Number of decimals place for this token
    uint8 public decimals = 18;

    // Address of contract deployer
    address public deployer;
    // Lockup status of tokens
    bool public lockup = true;

    /**
     * @notice Construct the CTF token contract
     * @param maxSupply Maximum supply of CTF token
     */
    function CerttifyToken(uint256 maxSupply) public {
        totalSupply = maxSupply.mul(10 ** uint256(decimals));
        balances[msg.sender] = totalSupply;
        deployer = msg.sender;
    }

    /**
     * @notice Modifier for function that can only be executed after lock up period. 
     * During the lockup period, only contract deployer can execute those functions
     */
    modifier afterLockup() {
        require(!lockup || msg.sender == deployer);
        _;
    }

    /**
     * @notice Remove the lock up of tokens, can only be called by contract deployer
     */
    function unlock() public {
        require(msg.sender == deployer);
        lockup = false;
    }

    /**
     * @dev Impose lock up period on transfer() to block transfer of token during that period
     */
    function transfer(address _to, uint256 _value) public afterLockup() returns (bool) {
        return super.transfer(_to, _value);
    }

    /**
     * @dev Impose lock up period on transferFrom() to block transfer of token during that period
     */
    function transferFrom(address _from, address _to, uint256 _value) public afterLockup() returns (bool) {
        return super.transferFrom(_from, _to, _value);
    }

    /**
     * @notice Burns a specific amount of tokens, and optionally broadcasting a message.
     * @param _value The amount of token to be burned.
     * @param _message Message to be included in the Burn event log.
     */
    function burn(uint256 _value, string _message) public afterLockup() {
        require(_value > 0);
        require(_value <= balances[msg.sender]);
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure
        address burner = msg.sender;
        // Burn!
        totalSupply = totalSupply.sub(_value);
        balances[burner] = balances[burner].sub(_value);
        // Log Burn event
        emit Burn(burner, _value, _message);
    }

    /**
     * @notice Burns a specific amount of tokens, and issue a certificate.
     * @param _value The amount of token to be burned.
     * @param _cert Certificate
     */
    function issueCert(uint256 _value, bytes _cert) external afterLockup() {
        // Burn the token if the issuer wants to do so
        // This is to leave flexibility in the future when 0 CTF certificiate is acceptable by the protocol
        if (_value > 0) { 
            burn(_value, "");
        }
        // Log IssueCert event
        emit IssueCert(keccak256(block.number, msg.sender, _value, _cert), msg.sender, _value, _cert);
    }

}