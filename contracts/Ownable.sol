pragma solidity 0.4.18;

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 * @dev Contract is based on zeppelin-solidity/ownership/Ownable.sol with minor edit
 */
contract Ownable {
  
    address public owner;

    /**
        * @dev The Ownable constructor sets the original `owner` of the contract to the sender
        * account.
        */
    function Ownable(address _owner) public {
        owner = _owner;
    }


    /**
        * @dev Throws if called by any account other than the owner.
        */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

}
