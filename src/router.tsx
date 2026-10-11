import { createBrowserRouter } from 'react-router'
import { BookPage } from './features/discover/BookPage.tsx'
import { DiscoverPage } from './features/discover/DiscoverPage.tsx'
import { LibraryPage } from './features/library/LibraryPage.tsx'
import { ReaderPage } from './features/reader/ReaderPage.tsx'
import { ReadingRoomPage } from './features/social/ReadingRoomPage.tsx'
import { AppShell, NotFound, RootLayout } from './ui/AppShell.tsx'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DiscoverPage /> },
          { path: 'book/:id', element: <BookPage /> },
          { path: 'library', element: <LibraryPage /> },
          { path: 'room', element: <ReadingRoomPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
      // The reader has its own full-screen chrome.
      { path: 'read/:id/:chapter?', element: <ReaderPage /> },
    ],
  },
])
