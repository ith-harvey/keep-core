pragma solidity ^0.5.4;

import "./KeepRandomBeaconBackend.sol";

/**
 * @title KeepRandomBeaconBackendStub
 * @dev A simplified Random Beacon backend contract to help local development.
 */
contract KeepRandomBeaconBackendStub is KeepRandomBeaconBackend {

    /**
     * @dev Stub method to authorize frontend contract to help local development.
     */
    function authorizeFrontendContract(address _frontendContract) public {
        frontendContract = _frontendContract;
    }

    /**
     * @dev Adds a new group based on groupPublicKey.
     * @param groupPublicKey is the identifier of the newly created group.
     */
    function registerNewGroup(bytes memory groupPublicKey) public {
        groups.push(Group(groupPublicKey, block.number));
        address[] memory members = orderedParticipants();
        if (members.length > 0) {
            for (uint i = 0; i < groupSize; i++) {
                groupMembers[groupPublicKey].push(members[i]);
            }
        }
    }

    /**
     * @dev Gets the group registration block height.
     * @param groupIndex is the index of the queried group.
     */
    function getGroupRegistrationBlockHeight(uint256 groupIndex) public view returns(uint256) {
        return groups[groupIndex].registrationBlockHeight;
    }

    /**
     * @dev Gets the public key of the group registered under the given index.
     * @param groupIndex is the index of the queried group.
     */
    function getGroupPublicKey(uint256 groupIndex) public view returns(bytes memory) {
        return groups[groupIndex].groupPubKey;
    }

    /**
     * @dev Gets the value of expired offset.
     */
    function getExpiredOffset() public view returns(uint256) {
        return expiredOffset;
    }

}
