const permissions = [
	{
		id: 'email-management',
		name: 'Email Management',
		description: 'Grants access to Email Management module',
	},
];

const permissionIds = permissions.map((p) => p.id);
module.exports = { permissionIds, permissions };
