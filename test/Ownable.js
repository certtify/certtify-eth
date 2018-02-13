var Ownable = artifacts.require("Ownable");

contract('Ownable', function(accounts) {

    var ownable;

    beforeEach(function(done) {
        Ownable.new(accounts[0]).then(function(_ownable) {
            ownable = _ownable;
            done();
        });
    });

    it('should have an owner equals to the address passed into the constructor', function(done) {
        ownable.owner.call().then(function(_owner) {
            assert(_owner === accounts[0]);
            done();
        });
    });
  
});