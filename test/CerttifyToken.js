// Require abstraction of CerttifyToken
var CerttifyToken = artifacts.require("CerttifyToken");

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

const tokenToCreate = web3.toBigNumber(500000000); // 5e8
const tokenCreatedDecimals = toDecimal(tokenToCreate);
const tokenToBurn = web3.toBigNumber('1e+26');
const tokenLeft = tokenCreatedDecimals.sub(tokenToBurn);

contract('CerttifyToken', function(accounts) {

    var token;

	beforeEach(function(done) {
		CerttifyToken.new(tokenToCreate, {
            from: accounts[0]
        }).then(function(_token) {
            token = _token;
            done();
		}).catch(function(err) {
			console.log(err);
			done('Error in creating the token token');
		});
	});

    it('Reward the token creator all the created token', function(done) {
        token.balanceOf.call(accounts[0]).then(function(balance) {
            // Assert balance of accounts[0] = all token created
            assert(balance.cmp(tokenCreatedDecimals) == 0, "Token created is not credited to the creator");
            done();
        });
    });

    it('transfer() can only be called by deployer in lock-up period', function(done) {
        token.lockup.call().then(function(lockup) {
            // Assert in lockup stage
            assert(lockup, 'Token created is not in lock up phase');
            // Transfer from accounts[0] should succeed since he is the deployer
            return token.transfer(accounts[1], toDecimal(100));
        }).then(function() {
            // Get balanceOf(accounts[1])
            return token.balanceOf.call(accounts[1]);
        }).then(function(balance1) {
            // Assert balance to be 100
            assert(balance1.cmp(toDecimal(100)) == 0, 'Transaction from deployer during lock up period failed');
            // Attempt to transfer from accounts[1]
            return token.transfer(accounts[2], toDecimal(100), { from: accounts[1] });
        }).then(function() {
            done('transfer is not locked during lock up period');
        }).catch(function(err) {
            assertRevert(err); // Assert revert on EVM
            done();
        });
    });

    it('transferFrom() cannot be called in lock-up period', function(done) {
        // Transfer from accounts[0] should succeed since he is the deployer
        token.transfer(accounts[1], toDecimal(100)).then(function() {
            // Approve accounts[2] to transferFrom on behalf of accounts[1]
            // This should succeed since there is no lock up on approve() function
            return token.approve(accounts[2], toDecimal(100), { from: accounts[1] });
        }).then(function() {
            // transferFrom should fail in lock up period if sent by address other than deployer
            return token.transferFrom(accounts[1], accounts[3], toDecimal(100), { from: accounts[2] });
        }).then(function() {
            done('transferFrom is not locked during lock up period');
        }).catch(function(err) {
            assertRevert(err); // Assert revert on EVM
            done();
        });
    });

    it('Token can be unlocked with unlock()', function(done) {
        token.unlock().then(function() {
            // Get lockup status
            return token.lockup.call();
        }).then(function(lockup) {
            assert(!lockup, 'Lockup is not removed after unlock() call');
            done();
        }).catch(function(err) {
            done(err);
        });
    });

    it('Burn token subtract from balance correctly and reduce the total supply', function(done) {
        token.unlock().then(function() {
            // Burn() to burn 1e+26 token
            return token.burn(tokenToBurn, "SOME_WAVES_ADDRESS");
        }).then(function() {
            // Wait for burn() to execute, and call balanceOf(accounts[0])
            return token.balanceOf.call(accounts[0]);
        }).then(function(balance) {
            // Assert balance of accounts[0] = all token created - token burnt
            assert.equal(balance.valueOf(), tokenLeft, "Burn token did not subtract the balance of burner correctly");
            // Call totalSupply()
            return token.totalSupply.call();
        }).then(function(totalSupply) {
            assert.equal(totalSupply.valueOf(), tokenLeft, "Burn token did not subtract total supply correctly");
            done();
        });
    });

    it('Burn token log is logged correctly', function(done) {
        token.unlock().then(function() {
            // Wait for contract deployment, and call burn() to burn 2e+26 token
            return token.burn(web3.toBigNumber('2e+26'), "SOME_WAVES_ADDRESS_123");
        }).then(function() {
            token.Burn().get(function(err, logs) {
                var event = logs[0].args;
                assert.equal(event.burner, accounts[0], "Burn log did not log the burner address correctly");
                assert.equal(event.value.valueOf(), web3.toBigNumber('2e+26'), "Burn log did not log the amount burnt correctly");
                assert.equal(event.wavesAddress, "SOME_WAVES_ADDRESS_123", "Burn log did not log the given Waves address correctly");
                done();
            });
        })
    });

    it('Cannot burn more than what you have', function(done) {
        token.unlock().then(function() {
            // Wait for contract deployment, and call burn() to burn 6e+26 token (more than total supply)
            return token.burn(web3.toBigNumber('6e+26'), "SOME_WAVES_ADDRESS");
        }).catch(function(err) {
            // Expect a error
            // Try to burn token from address with no token
            return token.burn(web3.toBigNumber('1'), "SOME_WAVES_ADDRESS", {
                'from': accounts[1]
            });
        }).catch(function(err) {
            // Expect a error
            assertRevert(err);
            done();
        });
    });

});