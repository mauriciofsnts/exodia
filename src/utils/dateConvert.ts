export const convertDurationToTimeString = (duration: number): string => {
	// const hours = Math.floor(duration / 3600);
	const minutes = Math.floor((duration % 3600) / 60);
	const seconds = duration % 60;

	const timeString = [minutes, seconds]
		.map((unit) => String(unit).padStart(2, '0'))
		.join(':');

	return timeString;
};

// Convert date to a dd/mm/yyyy format
export const convertDateToDateString = (date: Date): string => {
	const day = date.getDate();
	const month = date.getMonth() + 1;
	const year = date.getFullYear();

	const dateString = `${day}/${month}/${year}`;

	return dateString;
};
