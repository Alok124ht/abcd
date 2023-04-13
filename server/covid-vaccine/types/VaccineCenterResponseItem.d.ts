import VaccineSessionResponseItem from './VaccineSessionResponseItem';

interface VaccineCenterResponseItem {
	center_id: number;
	fee_type: string;
	block_name: string;
	pincode: number;
	name: string;
	sessions: VaccineSessionResponseItem[];
}

export default VaccineCenterResponseItem;
