var Crowdsale = artifacts.require("CerttifyCrowdsale");
var CerttifyToken = artifacts.require("CerttifyToken");
var Bounty = artifacts.require("Bounty");

// Utility Functions
/**
 * Return timestamp in seconds (after delaying for delayInMinutes minutes) since Unix epoch
 */
var getTimestamp = function(delayInMinutes) {
    var d = new Date();
    d.setTime(new Date().getTime() + delayInMinutes * 60 * 1000);
    return Math.floor(d.getTime() / 1000);
}
/**
 * Function for returning the balance of a given address on the token contract
 */
var getTokenBalance = function(instance, address) {
    return new Promise(function(resolve, reject) {
        instance.balanceOf.call(address).then(function(balance) {
            resolve(balance);
        }).catch(function(err) {
            reject(err);
        });
    });
}
/**
 * Assert a promise will returns 'revert' on EVM upon execution
 * Modified from assertRevert from zeppelin-soldity
 * 
 * Returns a promise which will resolve if revert event is detected, or throw if not
 */
var assertRevert = function(promise) {
    return new Promise(function(resolve, reject) {
        promise.then(function() {
            reject('Error containing "revert" must be returned');
        }).catch(function(err) {
            if (err.message.search('revert') == -1) {
                // Revert not triggered
                reject('Error containing "revert" must be returned');
            }
            else {
                resolve();
            }
        })
    })
}

contract('Bounty', function(accounts) {

    var token = null; // Token contract instance
    var bounty = null; // Bounty contract instance

    // Addresses and amounts used in the tests
    const addresses = [
        accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]
    ];
    const amounts = [
        web3.toBigNumber('1e+20'),
        web3.toBigNumber('2e+20'),
        web3.toBigNumber('1e+21'),
        web3.toBigNumber('2e+21'),
        web3.toBigNumber('1e+22')
    ];

    beforeEach(function(done) {
        const _timestampStage1 = getTimestamp(0);
        const _timestampStage2 = getTimestamp(0);
        const _timestampStage3 = getTimestamp(0);
        const _timestampEndTime = getTimestamp(0); 
        const _weiCostOfTokenStage1 = web3.toBigNumber('10000000000000');
        const _weiCostOfTokenStage2 = web3.toBigNumber('12000000000000');
        const _weiCostOfTokenStage3 = web3.toBigNumber('15000000000000');
        const _wallet = '0x6c2aafbb393d67e7057c34e7c8389e864928361b'; // Just a random address for testing
        const _owner = accounts[0];
        const _bountyAdmin = accounts[1];
        const _founderTokenUnlockPhase1 = getTimestamp(50);
        const _founderTokenUnlockPhase2 = getTimestamp(60);
        const _founderTokenUnlockPhase3 = getTimestamp(70);
        const _founderTokenUnlockPhase4 = getTimestamp(80);
        var crowdsaleInstance = null;
        Crowdsale.new(_timestampStage1, _timestampStage2, _timestampStage3, _timestampEndTime, _weiCostOfTokenStage1, _weiCostOfTokenStage2, _weiCostOfTokenStage3, _wallet, _owner, _bountyAdmin, _founderTokenUnlockPhase1, _founderTokenUnlockPhase2, _founderTokenUnlockPhase3, _founderTokenUnlockPhase4, {
            from: accounts[1]
        }).then(function(_instance) {
            crowdsaleInstance = _instance;
            // Call postICO
            return crowdsaleInstance.postICO({
                from: accounts[0]
            });
        }).then(function() {
            var promises = [];
            promises.push(crowdsaleInstance.token.call());
            promises.push(crowdsaleInstance.bounty.call());
            return Promise.all(promises);
        }).then(function(results) {
            token = CerttifyToken.at(results[0]);
            bounty = Bounty.at(results[1]);
            done();
        });
    });

    it('Bounty admin is set successfully', function(done) {
        bounty.owner.call().then(function(admin) {
            assert(accounts[1] == admin, 'Bounty admin is not set correctly');
            done();
        }).catch(function(err) {
            done(err);
        });
    });

    it('Set bounties for addresses', function(done) {
        bounty.setBounties(addresses, amounts, {
            from: accounts[1]
        }).then(function() {
            var promises = [];
            for (var i=0; i<addresses.length; i++) {
                promises.push(bounty.bounties.call(addresses[i]));
            }
            return Promise.all(promises);
        }).then(function(_amounts) {
            for (var i=0; i<amounts.length; i++) {
                assert(amounts[i].cmp(_amounts[i]) == 0, 'Bounties set on contract mismatched');
            }
            done();
        });
    });

    it('Update bounty for addresses after being set', function(done) {
        const addresses_update = [ accounts[0], accounts[1] ];
        const amounts_update = [ web3.toBigNumber('1e+23'), web3.toBigNumber('2e+23') ];
        bounty.setBounties(addresses, amounts, {
            from: accounts[1]
        }).then(function() {
            return bounty.setBounties(addresses_update, amounts_update, { from: accounts[1] });
        }).then(function(receipt) {
            var promises = [];
            for (var i=0; i<addresses_update.length; i++) {
                promises.push(bounty.bounties.call(addresses_update[i]));
            }
            return Promise.all(promises);
        }).then(function(_amounts) {
            for (var i=0; i<amounts_update.length; i++) {
                assert(amounts_update[i].cmp(_amounts[i]) == 0, 'Bounties set on contract mismatched');
            }
            done();
        });
    });

    it('Non-admin cannot set bounty', function(done) {
        assertRevert(bounty.setBounties(addresses, amounts, {
            from: accounts[0]
        })).then(function() {
            done();
        });
    });

    it('Cannot set bounty with mismatched length of addresses and amounts array', function(done) {
        assertRevert(bounty.setBounties(addresses, [ web3.toBigNumber('1e+22') ], {
            from: accounts[1]
        })).then(function() {
            done();
        });
    });

    it('Bounty cannot be withdrawn before unlock', function(done) {
        bounty.setBounties(addresses, amounts, {
            from: accounts[1]
        }).then(function() {
            return assertRevert(bounty.withdrawBounty({ from: accounts[0] }));
        }).then(function() {
            done();
        }).catch(function(err) {
            done(err);
        });
    });

    it('Withdraw the bounties set', function(done) {
        bounty.setBounties(addresses, amounts, {
            from: accounts[1]
        }).then(function() {
            return bounty.enableWithdrawl({ from: accounts[1] });
        }).then(function() {
            var promises = [];
            for (var i=0; i<addresses.length; i++) {
                promises.push(bounty.withdrawBounty({ from: addresses[i] }));
            }
            return Promise.all(promises);
        }).then(function() {
            var promises = [];
            for (var i=0; i<addresses.length; i++) {
                promises.push(getTokenBalance(token, addresses[i]));
            }
            return Promise.all(promises);
        }).then(function(_balances) {
            for (var i=0; i<addresses.length; i++) {
                assert(amounts[i].cmp(_balances[i]) == 0, 'Token withdrawn mismatched');
            }
            done();
        });
    });

    it('Withdraw the bounties set via fallback function', function(done) {
        bounty.setBounties(addresses, amounts, {
            from: accounts[1]
        }).then(function() {
            return bounty.enableWithdrawl({ from: accounts[1] });
        }).then(function() {
            var promises = [];
            for (var i=0; i<addresses.length; i++) {
                promises.push(new Promise(function(resolve, reject) {
                    web3.eth.sendTransaction({
                        from: addresses[i],
                        to: bounty.address,
                        value: 0,
                        gas: 500000
                    }, function(err, txHash) {
                        if (err) { reject(err); }
                        resolve();
                    });
                }));
            }
            return Promise.all(promises);
        }).then(function() {
            var promises = [];
            for (var i=0; i<addresses.length; i++) {
                promises.push(getTokenBalance(token, addresses[i]));
            }
            return Promise.all(promises);
        }).then(function(_balances) {
            for (var i=0; i<addresses.length; i++) {
                assert(amounts[i].cmp(_balances[i]) == 0, 'Token withdrawn mismatched');
            }
            done();
        });
    });

    it('Cannot withdraw token without bounty set', function(done) {
        bounty.setBounties([ accounts[0], accounts[1] ], [ web3.toBigNumber('1e+20'), web3.toBigNumber('2e+20')], {
            from: accounts[1]
        }).then(function() {
            return bounty.enableWithdrawl({ from: accounts[1] });
        }).then(function() {
            return assertRevert(bounty.withdrawBounty({ from: addresses[2] }));
        }).then(function() {
            done();
        });
    });

});