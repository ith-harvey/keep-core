package group

// MessageFiltering interface defines method allowing to filter out messages
// from members that are not part of the group or were marked as IA or DQ.
type MessageFiltering interface {

	// IsSenderAccepted returns true if the message from the given sender should be
	// accepted for further processing. Otherwise, function returns false.
	// Message from the given sender is allowed only if that member is a properly
	// operating group member - it was not DQ or IA so far.
	IsSenderAccepted(senderID MemberIndex) bool
}

// InactiveMemberFilter is a proxy facilitates filtering out inactive members
// in the given phase and registering their final list in DKG Group.
type InactiveMemberFilter struct {
	selfMemberID MemberIndex
	group        *Group

	phaseActiveMembers []MemberIndex
}

// NewInactiveMemberFilter creates a new instance of InactiveMemberFilter.
// It accepts member index of the current member (the one which will be
// filtering out other group members for inactivity) and the reference to Group
// to which all those members belong.
func NewInactiveMemberFilter(
	selfMemberIndex MemberIndex,
	group *Group,
) *InactiveMemberFilter {
	return &InactiveMemberFilter{
		selfMemberID:       selfMemberIndex,
		group:              group,
		phaseActiveMembers: make([]MemberIndex, 0),
	}
}

// MarkMemberAsActive marks member with the given index as active in the given
// phase.
func (mf *InactiveMemberFilter) MarkMemberAsActive(memberID MemberIndex) {
	mf.phaseActiveMembers = append(mf.phaseActiveMembers, memberID)
}

// FlushInactiveMembers takes all members who were not previously marked as
// active and flushes them to DKG group as inactive members.
func (mf *InactiveMemberFilter) FlushInactiveMembers() {
	isActive := func(id MemberIndex) bool {
		if id == mf.selfMemberID {
			return true
		}

		for _, activeMemberID := range mf.phaseActiveMembers {
			if activeMemberID == id {
				return true
			}
		}

		return false
	}

	for _, operatingMemberID := range mf.group.OperatingMemberIDs() {
		if !isActive(operatingMemberID) {
			mf.group.MarkMemberAsInactive(operatingMemberID)
		}
	}
}
