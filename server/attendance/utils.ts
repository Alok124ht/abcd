import { AttendanceStatus } from '../types/Attendance';

export const attendanceStatuses: string[] = [
	AttendanceStatus.Present,
	AttendanceStatus.Absent,
	AttendanceStatus.Leave,
	AttendanceStatus.LatePresent,
	AttendanceStatus.CasualLeave,
	AttendanceStatus.SickLeave,
];
