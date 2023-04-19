async function importFile(filePath: string, asDefault?: boolean) {
	if (asDefault) return (await import(filePath))?.default;

	return await import(filePath);
}

export default importFile;
