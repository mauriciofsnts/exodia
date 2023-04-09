import { client } from 'index';

import cron from 'node-cron';

//                       # ┌────────────── second (optional)
//                       # │ ┌──────────── minute
//                       # │ │ ┌────────── hour
//                       # │ │ │ ┌──────── day of month
//                       # │ │ │ │ ┌────── month
//                       # │ │ │ │ │ ┌──── day of week
//                       # │ │ │ │ │ │
//                       # │ │ │ │ │ │
//                       # * * * * * *
const job = cron.schedule('0 0 * * *', () => {
	console.info('Daily news request reset');

	// reset daily news request
	client.dailyNewsRequest = 0;
});

export { job };
