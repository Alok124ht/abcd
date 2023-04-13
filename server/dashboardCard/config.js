const cardTypes = ['image', 'text-card'];

const sizeTagType = {
	label: 'Card Size',
	type: 'breakpoint-grid',
	key: 'size',
	help:
		'Set size to 12 if you want card to be half of the full width. Eg: {"sm":24, "md":12} will make card to be full width on mobile and half size on tablet and desktop.',
};

const cardConfigs = {
	'text-card': {
		label: 'Text Card',
		tags: [
			{
				label: 'Heading',
				type: 'text',
				key: 'heading',
			},
			{
				label: 'Sub-Heading',
				type: 'text',
				key: 'subHeading',
			},
			{
				label: 'Content',
				type: 'text',
				key: 'content',
			},
			{
				label: 'Action button text',
				type: 'text',
				key: 'actionButtonText',
			},
			{
				label: 'Action URL',
				type: 'text',
				key: 'actionUrl',
				required: true,
			},
			{
				label: 'Background Color',
				type: 'color',
				key: 'backgroundColor',
			},
			{
				label: 'Border Color',
				type: 'color',
				key: 'borderColor',
			},
			{
				label: 'Action Button Text Color',
				type: 'color',
				key: 'actionButtonTextColor',
			},
			{
				label: 'Action Button Background Color',
				type: 'color',
				key: 'actionButtonBackgroundColor',
			},
			{
				label: 'Action Button Border Color',
				type: 'color',
				key: 'actionButtonBorderColor',
			},
			{
				label: 'Action Button Border Width',
				type: 'number',
				key: 'actionButtonBorderWidth',
			},
			{ label: 'Secondary Button', type: 'json', key: 'secondaryButton' },
			sizeTagType,
		],
	},
	image: {
		label: 'Image',
		tags: [sizeTagType],
	},
};

module.exports = {
	types: cardTypes,
	configsByType: cardConfigs,
};
