/** Every piece of text the editor shows. The host can pass its own (for example from its translation system). */
export interface Labels {
	editor: string;
	toolbar: string;
	undo: string;
	redo: string;
	bold: string;
	italic: string;
	link: string;
	paragraph: string;
	heading2: string;
	heading3: string;
	heading4: string;
	bulletList: string;
	numberedList: string;
	quote: string;
	separator: string;
	rawTable: string;
	rawCode: string;
	rawImage: string;
	rawHelp: string;
	image: string;
	citation: string;
	source: string;
	quoteCitation: string;
	linkTitle: string;
	linkAddress: string;
	linkInvalid: string;
	apply: string;
	removeLink: string;
	cancel: string;
	imageTitle: string;
	imageAlt: string;
	imageAltHelp: string;
	imageAltFromHost: string;
	imageAltMissing: string;
	imageCaption: string;
	placement: string;
	placeCenter: string;
	placeLeft: string;
	placeRight: string;
	placeFull: string;
	moveUp: string;
	moveDown: string;
	insert: string;
	update: string;
	removeImage: string;
	removeImageTitle: string;
	removeFromArticle: string;
	removeFromArticleHelp: string;
	removeAndDelete: string;
	removeAndDeleteHelp: string;
	uploading: string;
	uploadFailed: string;
	deleteFailed: string;
	imageStillUsed: string;
	imageNotAllowed: string;
	backToText: string;
	citationLabel: (kind: 'src' | 'quote', id: number) => string;
}

export const labelsEn: Labels = {
	editor: 'Article text',
	toolbar: 'Formatting',
	undo: 'Undo',
	redo: 'Redo',
	bold: 'Bold',
	italic: 'Italic',
	link: 'Link',
	paragraph: 'Normal text',
	heading2: 'Heading 2',
	heading3: 'Heading 3',
	heading4: 'Heading 4',
	bulletList: 'Bulleted list',
	numberedList: 'Numbered list',
	quote: 'Quote',
	separator: 'Separator line',
	rawTable: 'Table (kept as written)',
	rawCode: 'Code (kept as written)',
	rawImage: 'Image not shown: its address is not allowed (kept as written)',
	rawHelp: 'The editor keeps this exactly as it was. To change it, edit the Markdown.',
	image: 'Insert image',
	citation: 'Insert citation',
	source: 'Source',
	quoteCitation: 'Quote',
	linkTitle: 'Link',
	linkAddress: 'Web address',
	linkInvalid: 'Use an address starting with https://, http://, mailto: or /',
	apply: 'Apply',
	removeLink: 'Remove link',
	cancel: 'Cancel',
	imageTitle: 'Image',
	imageAlt: 'Alternative text',
	imageAltHelp: 'Describe the picture for readers who cannot see it. Required.',
	imageAltFromHost:
		'This description belongs to the image itself and is changed where the image is managed.',
	imageAltMissing:
		'This image has no description yet. Readers cannot see it until one is added where the image is managed.',
	imageCaption: 'Caption',
	placement: 'Position',
	placeCenter: 'Centred',
	placeLeft: 'Left, text wraps',
	placeRight: 'Right, text wraps',
	placeFull: 'Full width',
	moveUp: 'Move up',
	moveDown: 'Move down',
	insert: 'Insert',
	update: 'Save',
	removeImage: 'Remove image',
	removeImageTitle: 'Remove this image?',
	removeFromArticle: 'Remove from this article only',
	removeFromArticleHelp: 'The file and its record are kept.',
	removeAndDelete: 'Remove and delete the file',
	removeAndDeleteHelp: 'The file and its database record are deleted for good.',
	uploading: 'Uploading image…',
	uploadFailed: 'The image could not be uploaded.',
	deleteFailed: 'The image was removed from the article, but the file could not be deleted.',
	imageStillUsed: 'The image appears again in this article, so its file was kept.',
	imageNotAllowed: 'This image address is not allowed.',
	backToText: 'Back to text',
	citationLabel: (kind, id) => `${kind === 'src' ? 'Source' : 'Quote'} ${id}`
};

export const labelsPl: Labels = {
	editor: 'Tekst artykułu',
	toolbar: 'Formatowanie',
	undo: 'Cofnij',
	redo: 'Ponów',
	bold: 'Pogrubienie',
	italic: 'Kursywa',
	link: 'Link',
	paragraph: 'Zwykły tekst',
	heading2: 'Nagłówek 2',
	heading3: 'Nagłówek 3',
	heading4: 'Nagłówek 4',
	bulletList: 'Lista punktowana',
	numberedList: 'Lista numerowana',
	quote: 'Cytat blokowy',
	separator: 'Linia oddzielająca',
	rawTable: 'Tabela (zachowana bez zmian)',
	rawCode: 'Kod (zachowany bez zmian)',
	rawImage: 'Obraz niewyświetlany: niedozwolony adres (zachowany bez zmian)',
	rawHelp: 'Edytor zachowuje ten fragment dokładnie tak, jak był. Aby go zmienić, edytuj Markdown.',
	image: 'Wstaw obraz',
	citation: 'Wstaw odwołanie do źródła',
	source: 'Źródło',
	quoteCitation: 'Cytat',
	linkTitle: 'Link',
	linkAddress: 'Adres strony',
	linkInvalid: 'Podaj adres zaczynający się od https://, http://, mailto: lub /',
	apply: 'Zastosuj',
	removeLink: 'Usuń link',
	cancel: 'Anuluj',
	imageTitle: 'Obraz',
	imageAlt: 'Tekst alternatywny',
	imageAltHelp: 'Opisz obraz dla czytelników, którzy go nie widzą. Wymagane.',
	imageAltFromHost:
		'Ten opis należy do samego obrazu i zmienia się tam, gdzie obrazem się zarządza.',
	imageAltMissing:
		'Ten obraz nie ma jeszcze opisu. Czytelnicy go nie zobaczą, dopóki opis nie zostanie dodany tam, gdzie obrazem się zarządza.',
	imageCaption: 'Podpis',
	placement: 'Położenie',
	placeCenter: 'Na środku',
	placeLeft: 'Z lewej, tekst opływa',
	placeRight: 'Z prawej, tekst opływa',
	placeFull: 'Pełna szerokość',
	moveUp: 'Przesuń wyżej',
	moveDown: 'Przesuń niżej',
	insert: 'Wstaw',
	update: 'Zapisz',
	removeImage: 'Usuń obraz',
	removeImageTitle: 'Usunąć ten obraz?',
	removeFromArticle: 'Usuń tylko z tego artykułu',
	removeFromArticleHelp: 'Plik i jego wpis zostają.',
	removeAndDelete: 'Usuń i skasuj plik',
	removeAndDeleteHelp: 'Plik i jego wpis w bazie zostaną skasowane na stałe.',
	uploading: 'Wysyłanie obrazu…',
	uploadFailed: 'Nie udało się wysłać obrazu.',
	deleteFailed: 'Obraz usunięto z artykułu, ale nie udało się skasować pliku.',
	imageStillUsed: 'Ten obraz występuje jeszcze w artykule, więc plik zostaje.',
	imageNotAllowed: 'Ten adres obrazu jest niedozwolony.',
	backToText: 'Powrót do tekstu',
	citationLabel: (kind, id) => `${kind === 'src' ? 'Źródło' : 'Cytat'} ${id}`
};
