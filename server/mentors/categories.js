const questions = {
	cv: {
		id: 'cv',
		label: 'Upload your CV',
		input: {
			type: 'file',
			accept: 'application/pdf',
			limit: 1,
		},
	},
	specifics: {
		id: 'specifics',
		label: 'Any specific area or doubts where mentor should focus on',
		input: {
			type: 'text',
			component: 'textarea',
			limit: -1,
		},
	},
	specifics_case_study: {
		id: 'specifics_case_study',
		label: 'Any specific type of case study which you want to discuss',
		input: {
			type: 'text',
			component: 'textarea',
			limit: -1,
		},
	},
};

const getQuestion = (key, options) => {
	const { required } = options;
	const question = questions[key];
	return Object.assign({}, question, {
		input: Object.assign({}, question.input, { required }),
	});
};

const categories = [
	{
		label: 'Test Resume Review',
		id: 'test_resume_review',
		xpRequired: 40,
		cost: 10,
		available:
			process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'testing',
		inputs: [
			getQuestion('cv', { required: true }),
			getQuestion('specifics', { required: true }),
		],
		filters: {
			keywords: ['resume_review'],
		},
		description: `<ul>
            <li>An hour long 2 sessions by professional mentors working in a relevant sector.</li>
            <li>Feedback on format, choices of words, presentation and other aspects of resume.</li>
            <li>Helping in writing down your work in the best possible way.</li>
            <li>Company and profile specific resume.</li>
          </ul>`,
	},
	{
		label: 'Resume Review',
		id: 'resume_review',
		xpRequired: process.env.NODE_ENV === 'development' ? 8000 : 2000,
		cost: 500,
		available: true,
		inputs: [getQuestion('cv', { required: true }), questions.specifics],
		filters: {
			keywords: ['resume_review'],
		},
		description: `<ul>
            <li>An hour long 2 sessions by professional mentors working in a relevant sector.</li>
            <li>Feedback on format, choices of words, presentation and other aspects of resume.</li>
            <li>Helping in writing down your work in the best possible way.</li>
            <li>Company and profile specific resume.</li>
          </ul>`,
	},
	{
		label: 'Mock Technical Interview',
		id: 'mock_technical_interview',
		xpRequired: 2000,
		cost: 500,
		available: true,
		inputs: [getQuestion('cv', { required: true }), questions.specifics],
		filters: {
			keywords: ['interviews', 'interview'],
		},
		description: `<ul>
            <li>An hour long detailed Technical round mock interview followed by feedback and discussion by professional mentors working in a relevant sector.</li>
            <li>Discussion of commonly asked questions and mistakes made during an interview.</li>
            <li>Sector specific doubt discussion.</li>
        </ul>`,
	},
	{
		label: 'Mock Case Study',
		id: 'mock_case_study',
		xpRequired: 4000,
		cost: 500,
		available: true,
		inputs: [
			getQuestion('cv', { required: true }),
			questions.specifics,
			questions.specifics_case_study,
		],
		filters: {
			keywords: ['interviews', 'interview', 'mock'],
		},
		description: `<ul>
            <li>An hour long 2 sessions by professional mentors working in a consulting firm.</li>
            <li>Each session consist of Case study and guesstimate rounds 40 min each followed by 15-20 min feedback.</li>
        </ul>`,
	},
	{
		label: 'Career Guidance',
		id: 'career_guidance',
		xpRequired: 4000,
		cost: 1000,
		available: true,
		inputs: [getQuestion('cv', { required: true }), questions.specifics],
		filters: {
			keywords: ['career_guidance'],
		},
		description: `<ul>
            <li>An hour long session by professional mentors having a diversed profile.</li>
            <li>Discussion of different career opportunities available for you.</li>
            <li>How to decide which career option will be the best for you.</li>
            <li>Skillset and other knowledge required.</li>
            <li>How to switch career from one profile to another .</li>
        </ul>`,
	},
	{
		label: 'Mock HR Interview',
		id: 'mock_hr_interview',
		xpRequired: 2000,
		cost: 500,
		available: true,
		inputs: [getQuestion('cv', { required: true }), questions.specifics],
		filters: {
			keywords: ['interviews', 'interview'],
		},
		description: `<ul>
            <li>An hour long detailed HR round mock interview followed by feedback and discussion by professional mentors working in a relevant sector.</li>
            <li>Discussion of commonly asked questions and mistakes made during an interview.</li>
            <li>Sector specific doubt discussion.</li>
        </ul>`,
	},
];

module.exports = {
	categories,
};
