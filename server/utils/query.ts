import QueryString from 'qs';

type QueryKeyType =
	| string
	| QueryString.ParsedQs
	| QueryString.ParsedQs[]
	| string[];

/**
 * Parse query value as number
 * @param value value from req.query
 * @returns value if it can be converted to integer, otherwise defaultValue
 */
export function parseAsInteger(value: QueryKeyType, defaultValue: number) {
	if (typeof value === 'string') {
		const parsedValue = parseInt(value, 10);
		if (!Number.isNaN(parsedValue)) {
			return parsedValue;
		}
	}

	return defaultValue;
}

/**
 * Parse query value as float number
 * @param value value from req.query
 * @returns value if it can be converted to float number, otherwise defaultValue
 */
export function parseAsFloat(value: QueryKeyType, defaultValue: number) {
	if (typeof value === 'string') {
		const parsedValue = parseFloat(value);
		if (!Number.isNaN(parsedValue)) {
			return parsedValue;
		}
	}

	return defaultValue;
}

/**
 * Parse query value as string
 * @param value value from req.query
 * @returns value if it is string, otherwise empty string
 */
export function parseAsString(value: QueryKeyType): string {
	if (typeof value === 'string') {
		return value;
	}
	return '';
}

export function parseAsStringArray(value: QueryKeyType): string[] {
	if (Array.isArray(value)) {
		return value.map(parseAsString);
	}
	return [];
}
