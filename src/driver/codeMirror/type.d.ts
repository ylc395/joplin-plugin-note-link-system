export interface Request {
  event: 'searchNotes';
  payload: {
    keyword: string;
  };
}
