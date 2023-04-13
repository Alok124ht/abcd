interface VaccineSessionResponseItem {
	available_capacity: number;
	date: string;
	min_age_limit: number;
	vaccine?: string;
	slots: string[];
}

export default VaccineSessionResponseItem;
