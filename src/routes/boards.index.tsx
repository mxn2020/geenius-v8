import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useSession } from '~/lib/auth-client'
import { CreateBoardForm } from '~/components/CreateBoardForm'
import { Loader } from '~/components/Loader'

export const Route = createFileRoute('/boards/')({
  component: BoardsPage,
  pendingComponent: () => <Loader />,
})

function BoardsPage() {
  const { data: session } = useSession()
  const [showCreateForm, setShowCreateForm] = useState(false)

  // Get boards for the current user if authenticated, otherwise get all boards
  const boardsQuery = useSuspenseQuery(
    convexQuery(api.board.getBoards, {
      authUserId: session?.user?.id,
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Your Boards</h1>
          {session?.user && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              + Create Board
            </button>
          )}
        </div>

        {boardsQuery.data.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No boards yet</h3>
              <p className="text-gray-600 mb-6">
                {session?.user 
                  ? "Create your first board to get started organizing your tasks."
                  : "Sign in to create and manage your own boards."
                }
              </p>
              {session?.user && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Create Your First Board
                </button>
              )}
              {!session?.user && (
                <Link
                  to="/auth/login"
                  search={{ redirect: undefined }}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium inline-block"
                >
                  Sign In to Get Started
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {boardsQuery.data.map((board: any) => (
              <Link
                key={board.id}
                to="/boards/$boardId"
                params={{ boardId: board.id }}
                className="group block"
              >
                <div
                  className="rounded-lg p-6 h-32 flex flex-col justify-between transition-all duration-200 hover:scale-105 hover:shadow-lg cursor-pointer"
                  style={{ backgroundColor: board.color }}
                >
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-gray-900">
                      {board.name}
                    </h3>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>{board.columns.length} columns</span>
                    <span>{board.items.length} cards</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Board Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <CreateBoardForm onClose={() => setShowCreateForm(false)} />
          </div>
        )}
      </div>
    </div>
  )
}