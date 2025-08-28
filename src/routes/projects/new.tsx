// src/routes/projects/new.tsx
import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCreateProjectMutation } from '~/queries'
import { useSession } from '~/lib/auth-client'
import { ProjectCreationForm } from '~/components/ProjectCreationForm'
import { Loader } from '~/components/Loader'
import type { ProjectFormData } from '~/types/index'

export const Route = createFileRoute('/projects/new')({
  component: NewProjectPage,
  pendingComponent: () => <Loader />,
})

function NewProjectPage() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const createProjectMutation = useCreateProjectMutation()

  const handleSubmitProject = async (data: ProjectFormData) => {
    if (!session?.user?.id) {
      throw new Error('User must be logged in to create projects')
    }

    const result = await createProjectMutation.mutateAsync({
      name: data.name,
      description: data.description,
      createdBy: session.user.id,
      metadata: data.metadata,
    })
    
    // Navigate to the new project's detail page
    navigate({ to: '/projects/$projectId', params: { projectId: result } })
  }

  const handleClose = () => {
    navigate({ to: '/projects' })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-2xl w-full m-4">
        <ProjectCreationForm 
          isOpen={true}
          onClose={handleClose}
          onSubmit={handleSubmitProject}
          isLoading={createProjectMutation.isPending}
        />
      </div>
    </div>
  )
}