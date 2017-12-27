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
 * Test based on the original test for StandardToken.sol found in https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/test/StandardToken.test.js
 * Edited to test the CerttifyToken contract, which inherit the BasicToken, directly
 */
contract('StandardToken', function(accounts) {

	var token;

	beforeEach(function(done) {
		CerttifyToken.new(100, {
            from: accounts[0]
        }).then(function(instance) {
			token = instance;
			return token.unlock(); // Remove lockup
		}).then(function() {
			done();
		}).catch(function(err) {
			console.log(err);
			done('Error in creating the token instance');
		});
	});

	it('should return the correct totalSupply after construction', function(done) {
		token.totalSupply.call().then(function(totalSupply) {
			assert(totalSupply.cmp(toDecimal(100)) == 0);
			done();
		}).catch(function(err) {
			done('Error in obtaining totalSupply');
		});
	});

	it('should return the correct allowance amount after approval', function(done) {
		token.approve(accounts[1], toDecimal(100)).then(function() {
			return token.allowance.call(accounts[0], accounts[1]);
		}).then(function(allowance) {
			assert(allowance.cmp(toDecimal(100)) == 0);
			done();
		}).catch(function(err) {
			done('Error in getting allowance');
		});
	});

	it('should return correct balances after transfer', function(done) {
		token.transfer(accounts[1], toDecimal(100)).then(function() {
			return token.balanceOf(accounts[0]);
		}).then(function(balance0) {
			assert(balance0.cmp(0) == 0);
			return token.balanceOf(accounts[1]);
		}).then(function(balance1) {
			assert(balance1.cmp(toDecimal(100)) == 0);
			done();
		}).catch(function(err) {
			done(err);
		});
	});

	it('should throw an error when trying to transfer more than balance', function(done) {
		token.transfer(accounts[1], toDecimal(101)).then(function() {
			assert.fail('should have thrown before');
			done('Error is not thrown');
		}).catch(function(err) {
			assertRevert(err);
			done();
		});
	});

	it('should return correct balances after transfering from another account', function(done) {
		token.approve(accounts[1], toDecimal(100)).then(function() {
			return token.transferFrom(accounts[0], accounts[2], toDecimal(100), { from: accounts[1] });
		}).then(function() {
			return token.balanceOf(accounts[0]);
		}).then(function(balance0) {
			assert(balance0.cmp(0) == 0);
			return token.balanceOf(accounts[1]);
		}).then(function(balance1) {
			assert(balance1.cmp(0) == 0);
			return token.balanceOf(accounts[2]);
		}).then(function(balance2) {
			assert(balance2.cmp(toDecimal(100)) == 0);
			done();
		}).catch(function(err) {
			done(err);
		});
	});

	it('should throw an error when trying to transfer more than allowed', function(done) {
		token.approve(accounts[1], toDecimal(99)).then(function() {
			return token.transferFrom(accounts[0], accounts[2], toDecimal(100), { from: accounts[1] });
		}).then(function() {
			assert.fail('should have thrown before');
			done('No error is thrown');
		}).catch(function(err) {
			assertRevert(err);
			done();
		});
	});

	it('should throw an error when trying to transferFrom more than _from has', function(done) {
		var balance0 = null;
		token.balanceOf.call(accounts[0]).then(function(_balance0) {
			balance0 = _balance0;
			return token.approve(accounts[1], 99);
		}).then(function() {
			return token.transferFrom(accounts[0], accounts[2], balance0 + 1, { from: accounts[1] });
		}).then(function() {
			assert.fail('should have thrown before');
			done('No error is thrown');
		}).catch(function(err) {
			assertRevert(err);
			done();
		});
	});

	describe('Validating allowance updates to spender', function() {

		var preApproved;

		it('should start with zero', function(done) {
			token.allowance(accounts[0], accounts[1]).then(function(_preApproved) {
				preApproved = _preApproved;
				assert(preApproved.cmp(0) == 0);
				done();
			}).catch(function(err) {
				done(err);
			})
		});

		it('should increase by 50 then decrease by 10', function(done) {
			var postIncrease = null;
			token.increaseApproval(accounts[1], toDecimal(50)).then(function() {
				return token.allowance(accounts[0], accounts[1]);
			}).then(function(_postIncrease) {
				postIncrease = _postIncrease;
				assert(preApproved.add(toDecimal(50)).cmp(postIncrease) == 0);
				return token.decreaseApproval(accounts[1], toDecimal(10));
			}).then(function() {
				return token.allowance(accounts[0], accounts[1]);
			}).then(function(postDecrease) {
				assert(postIncrease.sub(toDecimal(10)).cmp(postDecrease) == 0);
				done();
			}).catch(function(err) {
				done(err);
			});
		});
	});

	it('should increase by 50 then set to 0 when decreasing by more than 50', function(done) {
		token.approve(accounts[1], toDecimal(50)).then(function() {
			return token.decreaseApproval(accounts[1], toDecimal(60));
		}).then(function() {
			return token.allowance(accounts[0], accounts[1]);
		}).then(function(postDecrease) {
			assert(postDecrease.cmp(0) == 0);
			done();
		}).catch(function(err) {
			done(err);
		});
	});

	it('should throw an error when trying to transfer to 0x0', function(done) {
		token.transfer(0x0, toDecimal(100)).then(function() {
			assert.fail('should have thrown before');
			done('No error is thrown');
		}).catch(function(err) {
			assertRevert(err);
			done();
		});
	});

	it('should throw an error when trying to transferFrom to 0x0', function(done) {
		token.approve(accounts[1], toDecimal(100)).then(function() {
			return token.transferFrom(accounts[0], 0x0, toDecimal(100), { from: accounts[1] });
		}).then(function() {
			assert.fail('should have thrown before');
			done('No error is thrown');
		}).catch(function(err) {
			assertRevert(err);
			done();
		});
	});

});