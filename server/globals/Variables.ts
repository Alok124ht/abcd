import SuperGroupModel from '../group/superGroup.model';

class MongoVar {
	supergroupNames: {
		[superGroupId: string]: string;
	} = null;
	supergroupNamesUpdatedAt: Date = null;
	constructor() {
		this.supergroupNames = null;
		this.supergroupNamesUpdatedAt = null;
	}

	getSupergroupNames() {
		if (this.supergroupNames) {
			if (!this.supergroupNamesUpdatedAt) {
				return SuperGroupModel.getNames().then((supergroupNames) => {
					this.supergroupNames = supergroupNames;
					this.supergroupNamesUpdatedAt = new Date();
					return Promise.resolve(supergroupNames);
				});
			}
			const dateNow = new Date().getTime();
			const lastUpdate = new Date(this.supergroupNamesUpdatedAt).getTime();
			if (dateNow > lastUpdate + 24 * 3600 * 1000) {
				return SuperGroupModel.getNames().then((supergroupNames) => {
					this.supergroupNames = supergroupNames;
					this.supergroupNamesUpdatedAt = new Date();
					return Promise.resolve(supergroupNames);
				});
			}
			return Promise.resolve(this.supergroupNames);
		}
		return SuperGroupModel.getNames().then((supergroupNames) => {
			this.supergroupNames = supergroupNames;
			this.supergroupNamesUpdatedAt = new Date();
			return Promise.resolve(supergroupNames);
		});
	}
}

export default new MongoVar();
