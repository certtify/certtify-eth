// Require abstraction of CerttifyToken
var CerttifyToken = artifacts.require("CerttifyToken");

const tokenToCreate = web3.toBigNumber(500000000); // 5e8
const tokenCreatedDecimals = web3.toBigNumber('1e+18').mul(tokenToCreate); // 5e8 * 1e18
const tokenToBurn = web3.toBigNumber('1e+26');
const tokenLeft = tokenCreatedDecimals.sub(tokenToBurn);

contract('CerttifyToken', function(accounts) {

    it('Reward the token creator all the created token', function(done) {
        // Create new CerttifyToken contract from accounts[0]
        CerttifyToken.new(tokenToCreate, {
            from: accounts[0]
        }).then(function(instance) {
            // Wait for contract deployment, and call balanceOf(accounts[0])
            return instance.balanceOf.call(accounts[0]);
        }).then(function(balance) {
            // Assert balance of accounts[0] = all token created
            assert.equal(balance.valueOf(), tokenCreatedDecimals, "Token created is not credited to the creator");
            done();
        });
    });

    it('Burn token subtract from balance correctly and reduce the total supply', function(done) {
        var instance = null;
        // Create new CerttifyToken contract from accounts[0]
        CerttifyToken.new(tokenToCreate, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            // Wait for contract deployment, and call burn() to burn 1e+26 token
            return instance.burn(tokenToBurn, "SOME_WAVES_ADDRESS");
        }).then(function() {
            // Wait for burn() to execute, and call balanceOf(accounts[0])
            return instance.balanceOf.call(accounts[0]);
        }).then(function(balance) {
            // Assert balance of accounts[0] = all token created - token burnt
            assert.equal(balance.valueOf(), tokenLeft, "Burn token did not subtract the balance of burner correctly");
            // Call totalSupply()
            return instance.totalSupply.call();
        }).then(function(totalSupply) {
            assert.equal(totalSupply.valueOf(), tokenLeft, "Burn token did not subtract total supply correctly");
            done();
        });
    });

    it('Burn token log is logged correctly', function(done) {
        var instance = null;
        // Create new CerttifyToken contract from accounts[0]
        CerttifyToken.new(tokenToCreate, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            // Wait for contract deployment, and call burn() to burn 2e+26 token
            return instance.burn(web3.toBigNumber('2e+26'), "SOME_WAVES_ADDRESS_123");
        }).then(function() {
            instance.Burn().get(function(err, logs) {
                var event = logs[0].args;
                assert.equal(event.burner, accounts[0], "Burn log did not log the burner address correctly");
                assert.equal(event.value.valueOf(), web3.toBigNumber('2e+26'), "Burn log did not log the amount burnt correctly");
                assert.equal(event.wavesAddress, "SOME_WAVES_ADDRESS_123", "Burn log did not log the given Waves address correctly");
                done();
            });
        })
    });

    it('Cannot burn more than what you have', function(done) {
        var instance = null;
        // Create new CerttifyToken contract from accounts[0]
        CerttifyToken.new(tokenToCreate, {
            from: accounts[0]
        }).then(function(_instance) {
            instance = _instance;
            // Wait for contract deployment, and call burn() to burn 6e+26 token (more than total supply)
            return instance.burn(web3.toBigNumber('6e+26'), "SOME_WAVES_ADDRESS");
        }).catch(function(err) {
            // Expect a error
            // Try to burn token from address with no token
            return instance.burn(web3.toBigNumber('1'), "SOME_WAVES_ADDRESS", {
                'from': accounts[1]
            });
        }).catch(function(err) {
            // Expect a error
            done();
        });
    });

});