import { Question, Answer } from '../types';

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function generateSessionAnswersCSV(questions: Question[], answers: Answer[]): string {
  const headers = ['Answer ID', 'Question ID', 'Question Title', 'Question Type', 'Participant (Anonymous)', 'Response Value', 'Submitted At'];
  const rows: string[] = [headers.map((h) => `"${h}"`).join(',')];

  answers.forEach((ans) => {
    const q = questions.find((item) => item.id === ans.questionId);
    const qTitle = q ? q.title.replace(/"/g, '""') : 'Deleted Question';
    const val = Array.isArray(ans.value)
      ? ans.value.join('; ').replace(/"/g, '""')
      : String(ans.value).replace(/"/g, '""');

    rows.push([
      `"${ans.id}"`,
      `"${ans.questionId}"`,
      `"${qTitle}"`,
      `"${ans.type}"`,
      `"${ans.participantId}"`,
      `"${val}"`,
      `"${ans.submittedAt}"`,
    ].join(','));
  });

  return rows.join('\n');
}
