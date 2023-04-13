import Axios from 'axios';

export async function sendSMS(mobileNumber: string, message: string) {
	const params = {
		username: 'prepleafprep',
		pass: 'Va-8I!0i',
		senderid: 'PRPLEF',
		dltentityid: '1501663190000027555',
		dlttempid: '1507162109822475827',
		dest_mobileno: mobileNumber,
		message,
	};
	return Axios.get('https://smsjust.com/sms/user/urlsms.php', { params });
}
