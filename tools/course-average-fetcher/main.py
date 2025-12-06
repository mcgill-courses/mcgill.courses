import json
import os.path
from collections import defaultdict

from arrg import app, argument
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SHEET_URL = 'https://docs.google.com/spreadsheets/d/1NGUBQuF8FI6ebna86S1RHpc27srxpMbaSyjipIkr-gk/edit#gid=233834959'


def expand_term(term: str):
  """
  Expand the short form of a term string into a long form
  W2024 -> Winter 2024
  """

  if len(term) != 5 or term[0].lower() not in 'wfs':
    raise ValueError(f'Incorrect term format. String received: {term}')

  season = ''

  match term[0].lower():
    case 'w':
      season = 'Winter'
    case 'f':
      season = 'Fall'
    case 's':
      season = 'Summer'
    case _:
      pass

  return f'{season} {term[1:]}'


# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

# The ID and range of the crowdsourced average spreadsheet from McGill Enhanced.
SPREADSHEET_ID = '1NGUBQuF8FI6ebna86S1RHpc27srxpMbaSyjipIkr-gk'
RANGE_NAME = 'ResultsSimple!A3:F'


@app(description='Fetch course averages from the McGill Enhanced Google Sheet.')
class App:
  output_path: str = argument(
    '-o',
    '--output-path',
    help='The path to the file to write the data to.',
    default=os.path.join('..', '..', 'client', 'src', 'assets', 'course-averages-data.json'),
  )

  def run(self) -> None:
    creds = None

    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.json'):
      creds = Credentials.from_authorized_user_file('token.json', SCOPES)

    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
      if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
      else:
        flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
        creds = flow.run_local_server(port=0)
      # Save the credentials for the next run
      with open('token.json', 'w') as token:
        token.write(creds.to_json())

    try:
      service = build('sheets', 'v4', credentials=creds)

      # Call the Sheets API
      sheet = service.spreadsheets()
      result = sheet.values().get(spreadsheetId=SPREADSHEET_ID, range=RANGE_NAME).execute()
      values = result.get('values', [])

      if not values:
        print('No data found.')
        return

      result = defaultdict(list)

      for row in values:
        course_id = row[1]
        course_term = row[2]
        course_avg = row[3]

        result[course_id].append({'term': expand_term(course_term), 'average': course_avg})

      with open(os.path.join(self.output_path), 'w') as json_file:
        json.dump(result, json_file)

    except HttpError as err:
      print(err)


if __name__ == '__main__':
  App.from_args().run()
