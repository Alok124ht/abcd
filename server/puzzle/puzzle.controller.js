const Puzzle = require('./puzzle.model');
const Topic = require('../topic/topic.model').default;
const PuzzleAttempt = require('../models/PuzzleAttempt');

// const mongoose = require('mongoose');
// const ObjectId = mongoose.Types.ObjectId;

function create(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}

	const { puzzle } = req.body;
	const { id } = req.payload;
	const puzzle_ = new Puzzle({
		title: puzzle.title,
		content: {
			rawContent: JSON.stringify(puzzle.content.rawContent),
		},
		hint: {
			rawContent: JSON.stringify(puzzle.hint.rawContent),
		},
		solution: {
			rawContent: JSON.stringify(puzzle.solution.rawContent),
		},
		answer: puzzle.answer,
		level: puzzle.level,
		createdBy: id,
		answer: puzzle.answer,
		answer: puzzle.answer,
	});

	puzzle_.save().then((savedPuzzle) => {
		Topic.update({}, { $inc: { 'puzzles.total': 1 } }).then(() => {
			res.json({ success: true });
		});
	});
}

function getMany(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}

	return Puzzle.getMany(req.body.skip).then((puzzles) => {
		res.json(puzzles);
	});
}

function verify(req, res) {
	// should we reset stats of question is updated???
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}
	const { id } = req.body;
	Puzzle.get(id).then((puzzle) => {
		if (!puzzle.verifiedBy) {
			puzzle.verifiedBy = req.payload.id;
			puzzle.markModified('verifiedBy');
			puzzle.save().then(() => {
				Topic.update({}, { $inc: { 'puzzles.verified': 1 } }).then(() => {
					res.json({ success: true });
				});
			});
		} else {
			res.json({ success: true });
		}
	});
}

function publish(req, res) {
	//should we reset stats of question is updated???
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}
	const { id } = req.body;
	Puzzle.get(id).then((puzzle) => {
		if (!puzzle.publishedBy && puzzle.verifiedBy) {
			puzzle.publishedBy = req.payload.id;
			puzzle.markModified('publishedBy');
			puzzle.save().then(() => {
				Topic.update({}, { $inc: { 'puzzles.published': 1 } }).then(() => {
					res.json({ success: true });
				});
			});
		} else {
			res.json({ success: true });
		}
	});
}

function isNumeric(value) {
	return /^-{0,1}\d+$/.test(value);
}

function attempt(req, res) {
	const { id, answer } = req.body;
	if (isNumeric(answer)) {
		Puzzle.get(id).then((puzzle) => {
			if (puzzle) {
				PuzzleAttempt.create({
					user: req.payload.id,
					puzzle: puzzle._id,
					answer: answer,
				});
				res.json({
					success: true,
					puzzle,
				});
			}
		});
	} else {
		res.json({ success: false });
	}
}

module.exports = {
	create,
	getMany,
	verify,
	publish,
	attempt,
};
