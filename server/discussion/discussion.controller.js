const { ObjectId } = require('mongodb');
const Discussion = require('./discussion.model').default;
const Solutionrequest = require('./solutionrequest.model');
const User = require('../user/user.model').default;
const Question = require('../question/question.model').default;
const UserXp = require('../user/userxp.model');
const UserXpCache = require('../cache/UserXp');
const Email = require('../email/email.model');
const Notification = require('../models/Notification');
const { checkedUsername, secureDiscussion } = require('./utils');

function cloneDiscussion(discussion) {
	const clonedDiscussion = {};
	clonedDiscussion._id = discussion._id;
	clonedDiscussion.id = discussion.id;
	clonedDiscussion.threads = discussion.threads.map((t) => ({
		_id: t._id,
		kind: t.kind,
		text: t.text,
		upvotes: t.upvotes,
		downvotes: t.downvotes,
		user: t.user,
		threads: t.threads.map((tt) => ({
			_id: tt._id,
			text: tt.text,
			user: tt.user,
		})),
	}));
	return clonedDiscussion;
}

function get(req, res) {
	const { id } = req.payload;
	return Discussion.getByQID(req.params.questionId)
		.then((discussion) => {
			Solutionrequest.findOne({
				question: ObjectId(req.params.questionId),
				'users.user': ObjectId(id),
				managed: false,
			}).then((sr) => {
				const solutionRequested = !!sr;

				if (discussion) {
					const sDiscussion = secureDiscussion(discussion);
					sDiscussion.solutionRequested = solutionRequested;
					res.json(sDiscussion);
				} else {
					res.json({ threads: [], solutionRequested });
				}
			});
		})
		.catch(() => {
			res.status(404).json({
				error: { message: '404 Not Found' },
			});
		});
}

function createNotification(user, data, question) {
	const notification = new Notification({
		user: user._id,
		action: {
			type: 'redirect-internal',
			event: 'click',
			data: {
				question,
			},
		},
		content: {
			data,
			type: 'text',
		},
		product: 'preparation',
	});

	notification.save();
}

function comment(req, res, next) {
	// populate before sending discussion...
	const { aid, kind, text } = req.body;
	User.get(req.payload.id).then((user) => {
		Discussion.getByQID(aid).then((discussion) => {
			if (discussion) {
				const sentTo = {};
				sentTo[req.payload.id] = true;
				discussion.threads.forEach((t) => {
					if (!sentTo[t.user._id.toString()]) {
						sentTo[t.user._id.toString()] = true;

						createNotification(
							t.user,
							`${checkedUsername(
								user.username
							)} also commented on the question you commented on.`,
							discussion.id
						);
					}
				});

				discussion.threads.push({
					// don't use push!!
					kind,
					text,
					user: user._id,
					threads: [],
				});

				discussion.markModified('threads');
				discussion
					.save()
					.then(() => {
						const email = new Email({
							subject: 'Comment',
							data: `https://admin.prepleaf.com/questions/?id=${aid}`,
						});
						email.save();
						discussion.threads[discussion.threads.length - 1].user = {
							dp: user.dp,
							username: user.username,
						};
						res.json(secureDiscussion(discussion));
					})
					.catch((e) => next(e));
			} else {
				const newDiscussion = new Discussion({
					id: aid,
					threads: [
						{
							kind,
							text,
							user: user._id,
							threads: [],
						},
					],
				});
				newDiscussion
					.save()
					.then(() => {
						const email = new Email({
							subject: 'Comment',
							data: `https://admin.prepleaf.com/questions/?id=${aid}`,
						});
						email.save();
						const clone = cloneDiscussion(newDiscussion);
						clone.threads[0].user = { dp: user.dp, username: user.username };
						res.json(secureDiscussion(clone));
					})
					.catch((e) => next(e));
			}
		});
	});
}

function deleteComment(req, res) {
	const {
		payload: { role },
	} = req;
	const { id } = req.body;
	Discussion.getByTID(id).then((discussion) => {
		let sent = false;
		discussion.threads.forEach((thread) => {
			if (thread._id.toString() === id) {
				if (
					role === 'super' ||
					thread.user._id.toString() === req.payload.id.toString()
				) {
					thread.set('isDeleted', true);
					discussion.markModified('threads');
					discussion.save();
					sent = true;
					res.json({ success: true, discussion: secureDiscussion(discussion) });
				} else {
					sent = true;
					res.json({ success: false, error: { code: 'invalid-ownership' } });
				}
			}
		});
		if (!sent) {
			res.json({ success: false, error: { code: 'comment-not-found' } });
		}
	});
}

function deleteReply(req, res) {
	const { cid, id } = req.body;
	User.get(req.payload.id).then((user) => {
		Discussion.getByTID(cid).then((discussion) => {
			let sent = false;
			discussion.threads.forEach((thread) => {
				if (thread._id.toString() === cid) {
					thread.threads.forEach((t) => {
						if (t._id.toString() === id) {
							if (t.user._id.toString() === user._id.toString()) {
								t.set('isDeleted', true);
								discussion.markModified('threads');
								discussion.save();
								sent = true;
								res.json({ success: true, discussion: secureDiscussion(discussion) });
							} else {
								sent = true;
								res.json({ success: false, error: { code: 'invalid-ownership' } });
							}
						}
					});
				}
			});
			if (!sent) {
				res.json({ success: false, error: { code: 'reply-not-found' } });
			}
		});
	});
}

function editComment(req, res) {
	const { id, text } = req.body;
	User.get(req.payload.id).then((user) => {
		Discussion.getByTID(id).then((discussion) => {
			let sent = false;
			discussion.threads.forEach((thread) => {
				if (thread._id.toString() === id) {
					if (thread.user._id.toString() === user._id.toString()) {
						thread.text = text;
						discussion.markModified('threads');
						discussion.save();
						sent = true;
						res.json({ success: true, discussion: secureDiscussion(discussion) });
					} else {
						sent = true;
						res.json({ success: false, error: { code: 'invalid-ownership' } });
					}
				}
			});
			if (!sent) {
				res.json({ success: false, error: { code: 'comment-not-found' } });
			}
		});
	});
}

function editReply(req, res, next) {
	const { cid, id, text } = req.body;
	User.get(req.payload.id).then((user) => {
		Discussion.getByTID(cid).then((discussion) => {
			let sent = false;
			discussion.threads.forEach((thread) => {
				if (thread._id.toString() == cid) {
					thread.threads.forEach((t) => {
						if (t._id.toString() == id) {
							if (t.user._id.toString() == user._id.toString()) {
								t.text = text;
								discussion.markModified('threads');
								discussion.save();
								sent = true;
								res.json({ success: true, discussion: secureDiscussion(discussion) });
							} else {
								sent = true;
								res.json({ success: false, error: { code: 'invalid-ownership' } });
							}
						}
					});
				}
			});
			if (!sent) {
				res.json({ success: false, error: { code: 'reply-not-found' } });
			}
		});
	});
}

function reply(req, res, next) {
	// populate before sending discussion...
	const { tid, text } = req.body;
	User.get(req.payload.id).then((user) => {
		Discussion.getByTID(tid).then((discussion) => {
			let found = -1;
			discussion.threads.forEach((thread, idx) => {
				if (thread._id.toString() === tid) {
					const sentTo = {};
					sentTo[req.payload.id] = true;
					sentTo[thread.user._id] = true;
					if (req.payload.id !== thread.user._id.toString()) {
						createNotification(
							thread.user,
							`${checkedUsername(user.username)} replied to your comment.`,
							discussion.id
						);
					}

					thread.threads.forEach((t) => {
						if (!sentTo[t.user._id.toString()]) {
							sentTo[t.user._id.toString()] = true;
							createNotification(
								t.user,
								`${checkedUsername(
									user.username
								)} also replied to the comment you replied to.`,
								discussion.id
							);
						}
					});

					thread.threads.push({
						user: user._id,
						text,
					});
					found = idx;
				}
			});
			discussion.markModified('threads');
			discussion
				.save()
				.then(() => {
					const email = new Email({
						subject: 'Reply',
						data: `https://admin.prepleaf.com/questions/?id=${discussion.id}`,
					});
					email.save();
					if (found !== -1) {
						discussion.threads[found].threads[
							discussion.threads[found].threads.length - 1
						].user = { dp: user.dp, username: user.username };
						res.json(secureDiscussion(discussion));
					} else {
						res.json(secureDiscussion(discussion));
					}
				})
				.catch((e) => next(e));
		});
	});
}

function upvote(req, res) {
	const { tid } = req.body;
	User.get(req.payload.id).then((user) => {
		Discussion.getByTID(tid).then((discussion) => {
			let tId = -1;
			discussion.threads.forEach((thread, idx) => {
				if (thread._id.toString() == tid) {
					tId = idx;
					if (req.payload.id != thread.user._id.toString()) {
						createNotification(
							thread.user,
							`${checkedUsername(user.username)} upvoted your comment.`,
							discussion.id
						);
					}
				}
			});
			if (tId !== -1) {
				const selector1 = {};
				const operator1 = {};
				selector1[`threads.${tId}.upvotes`] = req.payload.id;
				operator1.$addToSet = selector1;
				const selector2 = {};
				const operator2 = {};
				selector2[`threads.${tId}.downvotes`] = req.payload.id;
				operator2.$pull = selector2;

				Discussion.update({ 'threads._id': tid }, operator1)
					.exec()
					.then(() => {
						Discussion.update({ 'threads._id': tid }, operator2)
							.exec()
							.then(() => {
								Discussion.getByTID(tid).then((discussion) => {
									res.json(discussion);
								});
							});
					});
			} else {
				console.log('some error!!');
			}
		});
	});
}

function downvote(req, res) {
	const { tid } = req.body;
	User.get(req.payload.id).then((user) => {
		Discussion.getByTID(tid).then((discussion) => {
			let tId = -1;
			discussion.threads.forEach((thread, idx) => {
				if (thread._id.toString() == tid) {
					tId = idx;
					if (req.payload.id != thread.user._id.toString()) {
						createNotification(
							thread.user,
							`${checkedUsername(user.username)} downvoted your comment.`,
							discussion.id
						);
					}
				}
			});
			if (tId !== -1) {
				const selector1 = {};
				const operator1 = {};
				selector1[`threads.${tId}.downvotes`] = req.payload.id;
				operator1.$addToSet = selector1;
				const selector2 = {};
				const operator2 = {};
				selector2[`threads.${tId}.upvotes`] = req.payload.id;
				operator2.$pull = selector2;
				Discussion.update({ 'threads._id': tid }, operator1)
					.exec()
					.then(() => {
						Discussion.update({ 'threads._id': tid }, operator2)
							.exec()
							.then(() => {
								Discussion.getByTID(tid).then((discussion) => {
									res.json(discussion);
								});
							});
					});
			} else {
				console.log('some error!!');
			}
		});
	});
}

function removeupvote(req, res) {
	const { tid } = req.body;
	Discussion.getByTID(tid).then((discussion) => {
		let tId = -1;
		discussion.threads.forEach((thread, idx) => {
			if (thread._id.toString() == tid) tId = idx;
		});
		if (tId !== -1) {
			const selector = {};
			const operator = {};
			selector[`threads.${tId}.upvotes`] = req.payload.id;
			operator.$unset = selector;

			Discussion.update({ 'threads._id': tid }, operator)
				.exec()
				.then(() => {
					Discussion.getByTID(tid).then((discussion) => {
						res.json(discussion);
					});
				});
		} else {
			console.log('some error!!');
		}
	});
}

function removedownvote(req, res) {
	const { tid } = req.body;
	Discussion.getByTID(tid).then((discussion) => {
		let tId = -1;
		discussion.threads.forEach((thread, idx) => {
			if (thread._id.toString() == tid) tId = idx;
		});
		if (tId !== -1) {
			const selector = {};
			const operator = {};
			selector[`threads.${tId}.downvotes`] = req.payload.id;
			operator.$unset = selector;

			Discussion.update({ 'threads._id': tid }, operator)
				.exec()
				.then(() => {
					Discussion.getByTID(tid).then((discussion) => {
						res.json(discussion);
					});
				});
		} else {
			console.log('some error!!');
		}
	});
}

function requestSolution(req, res) {
	const { id } = req.payload;
	const { question } = req.body;
	Solutionrequest.findOne({ question: ObjectId(question) }).then((request) => {
		if (request) {
			let found = false;
			request.users.forEach((u) => {
				if (u.user.toString() === id) found = true;
			});
			if (!found) {
				Solutionrequest.update(
					{ question: ObjectId(question) },
					{ $addToSet: { users: { user: ObjectId(id) } } }
				).then(() => {
					res.json({ success: true });
				});
			} else {
				res.json({ success: true });
			}
		} else {
			const solnreq = new Solutionrequest({
				question,
				users: [{ user: id }],
			});
			solnreq.save().then(() => {
				res.json({ success: true });
			});
		}
	});
}

function notifySolution(req, res) {
	const { id } = req.body;
	Solutionrequest.findOne({ _id: ObjectId(id), managed: false }).then(
		(request) => {
			if (request) {
				request.users.forEach((u) => {
					createNotification(
						{ _id: u.user },
						`Solution is now available for this question.`,
						request.question
					);
				});
				Solutionrequest.update(
					{ _id: ObjectId(id) },
					{ $set: { managed: true } }
				).then(() => {
					res.json({ success: true });
				});
			} else {
				res.json({ success: false });
			}
		}
	);
}

function getRequests(req, res) {
	const rt = new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000);
	Solutionrequest.find({ managed: false }).then((requests) => {
		Notification.find(
			{ 'action.type': 'redirect-solution-request', createdAt: { $gte: rt } },
			{ 'action.data.question': 1 }
		).then((questions) => {
			const notificationByQuestions = {};
			questions.forEach((q) => {
				if (!notificationByQuestions[q.action.data.question]) {
					notificationByQuestions[q.action.data.question] = 0;
				}
				notificationByQuestions[q.action.data.question] += 1;
			});

			const requests_ = requests.map((r) => ({
				sents: notificationByQuestions[r.question]
					? notificationByQuestions[r.question]
					: 0,
				createdAt: r.createdAt,
				lastSent: r.lastSent,
				managed: r.managed,
				question: r.question,
				responses: r.responses,
				updatedAt: r.updatedAt,
				users: r.users,
				_id: r._id,
			}));
			res.json({ success: true, requests: requests_, questions });
		});
	});
}

function getRequest(req, res) {
	Solutionrequest.findOne({ _id: ObjectId(req.params.requestId) })
		.populate([{ path: 'question', populate: [{ path: 'statistics' }] }])
		.then((request) => {
			if (request) {
				res.json({ success: true, request });
			} else {
				res.json({ success: false });
			}
		});
}

function submitSolution(req, res) {
	const { id } = req.payload;
	const { question, solution } = req.body;
	Solutionrequest.findOne({ question: ObjectId(question) }).then((request) => {
		if (request) {
			if (!request.responses) {
				request.responses = [];
			}
			let found = false;
			request.responses.forEach((r) => {
				if (r.user.toString() == id) {
					found = true;
					r.solution = solution;
				}
			});
			if (!found) {
				request.responses.push({ user: ObjectId(id), solution });
			}
			request.markModified('responses');
			request
				.save()
				.then(() => {
					res.json({ success: true });
				})
				.catch(() => {
					res.json({ success: false, c: 1 });
				});
		} else {
			res.json({ success: false, c: 2 });
		}
	});
}

function getSolutionRequest(req, res) {
	const { id } = req.payload;
	const { qid } = req.body;
	Solutionrequest.findOne({ question: ObjectId(qid) })
		.populate([
			{
				path: 'question',
				select:
					'type options.content multiOptions.content content link topic sub_topic',
			},
		])
		.then((request) => {
			if (request) {
				let solution;
				request.responses.forEach((r) => {
					if (r.user.toString() === id) {
						solution = r.solution;
					}
				});

				res.json({ question: request.question, solution });
			} else {
				res.json({ success: false, c: 2 });
			}
		});
}

function acceptSolution(req, res) {
	const { role } = req.payload;
	if (role !== 'admin' || role !== 'super') {
		res.json({ success: false });
		return;
	}

	const { requestId, responseId } = req.body;

	Solutionrequest.findOne({ _id: requestId })
		.populate([
			{
				path: 'question',
				select:
					'_id type options.content multiOptions.content content link topic sub_topic',
			},
		])
		.then((request) => {
			if (request) {
				let found = -1;

				request.responses.forEach((r, idx) => {
					if (r._id.toString() === responseId) {
						found = idx;
					}
				});

				if (found !== -1) {
					request.responses[found].accepted = true;
					request.markModified('responses');
					request.save().then(() => {
						// reward xp
						UserXp.update(
							{ user: request.responses[found].user },
							{
								$push: {
									xp: { val: 100, reference: request.question._id, onModel: 'Question' },
								},
								$inc: {
									net: 100,
								},
							}
						).then(() => {
							UserXpCache.inc(request.responses[found].user, 100);
							res.json({ success: true, request });
						});

						Question.update(
							{ _id: request.question._id },
							{ $set: { solSubmittedBy: request.responses[found].user } }
						).exec();
					});
				} else {
					res.json({ success: false, c: 1 });
				}
			} else {
				res.json({ success: false, c: 2 });
			}
		});
}

module.exports = {
	get,
	comment,
	reply,
	upvote,
	downvote,
	removeupvote,
	removedownvote,
	deleteComment,
	deleteReply,
	editComment,
	editReply,
	requestSolution,
	notifySolution,
	getRequests,
	getRequest,
	submitSolution,
	getSolutionRequest,
	acceptSolution,
};
