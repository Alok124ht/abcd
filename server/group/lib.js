function secureLeaderboard(leaderboard) {
	return leaderboard.map((l) => ({
		assessmentId: l.assessmentId,
		assessment_toppers: l.assessment_toppers.splice(0, 20).map((at) => ({
			user: { dp: at.user.dp, username: at.user.username },
			username: at.username,
			rating: at.rating,
			marks: at.marks,
		})),
		overall_toppers: l.overall_toppers.splice(0, 20).map((ot) => ({
			user: { dp: ot.user.dp, username: ot.user.username },
			username: ot.username,
			rating: ot.rating,
			del_rating: ot.del_rating,
		})),
		sum_rating: l.sum_rating,
		tot_rating: l.tot_rating,
		hist: l.hist,
	}));
}

function secureSubscribedGroups(groups, subscriptions) {
	// simplify
	const groupMapping = {};
	subscriptions.forEach((s) => {
		s.subgroups.forEach((ss) => {
			if (ss.active) {
				groupMapping[ss.group] = true;
			}
		});
	});

	const groupIdx = [];
	groups.forEach((g, sidx) => {
		g.subgroups.forEach((sg, sgidx) => {
			if (groupMapping[sg.subgroup._id]) groupIdx.push({ g: sidx, sg: sgidx });
		});
	});

	const securedGroups = [];

	groupIdx.forEach((gidx) => {
		let found = -1;
		securedGroups.forEach((secg, k) => {
			if (secg._id.toString() == gidx.g) found = k;
		});

		if (found === -1) {
			securedGroups.push({
				_id: groups[gidx.g]._id,
				name: groups[gidx.g].name,
				isPremium: groups[gidx.g].isPremium,
				leaderboard: secureLeaderboard(groups[gidx.g].leaderboard),
				subgroups: [
					{
						subgroup: {
							_id: groups[gidx.g].subgroups[gidx.sg].subgroup._id,
							name: groups[gidx.g].subgroups[gidx.sg].subgroup.name,
							leaderboard: secureLeaderboard(
								groups[gidx.g].subgroups[gidx.sg].subgroup.leaderboard
							),
						},
					},
				],
				topicMocks: groups[gidx.g].topicMocks,
				sectionalMocks: groups[gidx.g].sectionalMocks,
				fullMocks: groups[gidx.g].fullMocks,
				liveTests: groups[gidx.g].liveTests,
			});
		} else {
			securedGroups[found].subgroups.push({
				subgroup: {
					_id: groups[gidx.g].subgroups[gidx.sg].subgroup._id,
					name: groups[gidx.g].subgroups[gidx.sg].subgroup.name,
					leaderboard: secureLeaderboard(
						groups[gidx.g].subgroups[gidx.sg].subgroup.leaderboard
					),
				},
			});
		}
	});

	return securedGroups;
}

function subscribedGroups(groups, subscriptions) {
	// some issue with this
	// simplify
	const groupMapping = {};
	subscriptions.forEach((s) => {
		s.subgroups.forEach((ss) => {
			if (ss.active) {
				groupMapping[ss.group] = true;
			}
		});
	});

	const groupIdx = [];
	groups.forEach((g, sidx) => {
		g.subgroups.forEach((sg, sgidx) => {
			if (groupMapping[sg.subgroup._id]) groupIdx.push({ g: sidx, sg: sgidx });
		});
	});

	const securedGroups = [];

	groupIdx.forEach((gidx) => {
		let found = -1;
		securedGroups.forEach((secg, k) => {
			if (secg._id.toString() == gidx.g) found = k; // should be compared with groups[gidx.g]._id
		});

		if (found === -1) {
			securedGroups.push({
				_id: groups[gidx.g]._id,
				name: groups[gidx.g].name,
				isPremium: groups[gidx.g].isPremium,
				leaderboard: secureLeaderboard(groups[gidx.g].leaderboard),
				subgroups: [groups[gidx.g].subgroups[gidx.sg]],
				topicMocks: groups[gidx.g].topicMocks,
				sectionalMocks: groups[gidx.g].sectionalMocks,
				fullMocks: groups[gidx.g].fullMocks,
				liveTests: groups[gidx.g].liveTests,
			});
		} else {
			securedGroups[found].subgroups.push(groups[gidx.g].subgroups[gidx.sg]);
		}
	});

	return securedGroups;
}

function secureGroups(groups, subscriptions, username) {
	// simplify
	const groupMapping = {};
	subscriptions.forEach((s) => {
		s.subgroups.forEach((ss) => {
			if (ss.active) {
				groupMapping[ss.group] = true;
			}
		});
	});

	if (
		(username && username.split('_')[0] === 'NOTSET') ||
		!subscriptions.length
	) {
		return groups.map((g) => ({
			_id: g._id,
			name: g.name,
			isPremium: g.isPremium,
			isCollegeRequired: g.isCollegeRequired,
			subgroups: g.subgroups.map((sg) => ({
				subgroup: {
					_id: sg.subgroup._id,
					name: sg.subgroup.name,
				},
			})),
		}));
	}

	const groupIdx = [];
	groups.forEach((g, sidx) => {
		g.subgroups.forEach((sg, sgidx) => {
			if (groupMapping[sg.subgroup._id]) groupIdx.push({ g: sidx, sg: sgidx });
		});
	});

	const securedGroups = [];

	groupIdx.forEach((gidx) => {
		let found = -1;
		securedGroups.forEach((secg, k) => {
			if (secg._id.toString() == gidx.g) found = k;
		});

		if (found === -1) {
			securedGroups.push({
				_id: groups[gidx.g]._id,
				name: groups[gidx.g].name,
				isPremium: groups[gidx.g].isPremium,
				isCollegeRequired: groups[gidx.g].isCollegeRequired,
				leaderboard: secureLeaderboard(groups[gidx.g].leaderboard),
				subgroups: [
					{
						subgroup: {
							_id: groups[gidx.g].subgroups[gidx.sg].subgroup._id,
							name: groups[gidx.g].subgroups[gidx.sg].subgroup.name,
							leaderboard: secureLeaderboard(
								groups[gidx.g].subgroups[gidx.sg].subgroup.leaderboard
							),
						},
					},
				],
			});
		} else {
			securedGroups[found].subgroups.push({
				subgroup: {
					_id: groups[gidx.g].subgroups[gidx.sg].subgroup._id,
					name: groups[gidx.g].subgroups[gidx.sg].subgroup.name,
					leaderboard: secureLeaderboard(
						groups[gidx.g].subgroups[gidx.sg].subgroup.leaderboard
					),
				},
			});
		}
	});

	return securedGroups;
}

module.exports = {
	secureSubscribedGroups,
	subscribedGroups,
	secureGroups,
	secureLeaderboard,
};
