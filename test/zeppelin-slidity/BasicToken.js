var CerttifyToken = artifacts.require('CerttifyToken');

/**
 * Assert the error contains revert
 * @param {*} error 
 */
var assertRevert = function(error) {
	assert.isAbove(error.message.search('revert'), -1, 'Error containing "revert" must be returned');
};
/**
 * Convert number of token into its decimal representation
 * @param {number} raw Number of token
 * @return {BigNumber} Decimal representation of that amount of token
 */
var toDecimal = function(raw) {
	return web3.toBigNumber(raw).mul(web3.toBigNumber('1e+18'));
}

/**
 * Test based on the original test for BasicToken.sol found in https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/BasicToken.test.js
 * Edited to test the CerttifyToken contract, which inherit the BasicToken, directly
 */
contract('BasicToken', function (accounts) {

	it('should return the correct totalSupply after construction', function(done) {
		CerttifyToken.new(100, {
            from: accounts[0]
        }).then(function(token) {
			return token.totalSupply.call();
		}).then(function(totalSupply) {
			assert(totalSupply.cmp(toDecimal(100)) == 0);
			done();
		}).catch(function(err) {
			done(err);
		});
	});

	it('should return correct balances after transfer', function(done) {
		var token = null;
		CerttifyToken.new(100, {
            from: accounts[0]
        }).then(function(_token) {
			token = _token;
			return token.transfer(accounts[1], toDecimal(100));
		}).then(function() {
			return token.balanceOf(accounts[0]);
		}).then(function(firstAccountBalance) {
			assert(firstAccountBalance.cmp(0) == 0);
			return token.balanceOf(accounts[1]);
		}).then(function(secondAccountBalance) {
			assert(secondAccountBalance.cmp(toDecimal(100)) == 0);
			done();
		}).catch(function(err) {
			done(err);
		});
	});

	it('should throw an error when trying to transfer more than balance', function(done) {
		CerttifyToken.new(100, {
            from: accounts[0]
        }).then(function(token) {
			return token.transfer(accounts[1], toDecimal(100).add(1));
		}).then(function() {
			done('No error is thrown');
		}).catch(function(err) {
			assertRevert(err);
			done();
		});
	});

	it('should throw an error when trying to transfer to 0x0', function(done) {
		CerttifyToken.new(100, {
            from: accounts[0]
        }).then(function(token) {
			return token.transfer(0x0, toDecimal(100));
		}).then(function() {
			done('No error is thrown');
		}).catch(function(err) {
			assertRevert(err);
			done();
		});
	});

});