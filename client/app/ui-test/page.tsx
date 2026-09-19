"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Users,
  UserPlus,
  Settings,
  Trash2,
  Eye,
  AlertTriangle,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  RefreshButton,
  Select,
  SummaryCard,
} from "@/components/ui";

export default function UITestPage() {
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [selectValue, setSelectValue] = useState("beginner");

  const handleRefresh = () => {
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-(--background) p-4 text-(--foreground) sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* PAGE HEADER */}
        <PageHeader
          eyebrow="DojoFlow UI System"
          title="Component Showcase"
          description="Testing all reusable UI components in light and dark mode."
          actions={
            <>
              <RefreshButton
                onClick={handleRefresh}
                loading={loading}
              />

              <Button
                variant="primary"
                onClick={() => setModalOpen(true)}
              >
                <Settings size={16} />
                Open Modal
              </Button>
            </>
          }
        />

        {/* BUTTONS */}
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Buttons
          </h2>

          <div className="flex flex-wrap gap-3">
            <Button variant="primary">
              Primary
            </Button>

            <Button variant="secondary">
              Secondary
            </Button>

            <Button variant="outline">
              Outline
            </Button>

            <Button variant="danger">
              Delete
            </Button>

            <Button variant="ghost">
              Ghost
            </Button>

            <Button loading>
              Loading
            </Button>

            <Button
              size="sm"
              variant="primary"
            >
              Small
            </Button>

            <Button
              size="lg"
              variant="primary"
            >
              Large
            </Button>
          </div>
        </Card>

        {/* ICON BUTTONS */}
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Icon Buttons
          </h2>

          <div className="flex flex-wrap gap-3">
            <IconButton
              label="View"
              variant="default"
            >
              <Eye size={18} />
            </IconButton>

            <IconButton
              label="Add Student"
              variant="primary"
            >
              <UserPlus size={18} />
            </IconButton>

            <IconButton
              label="Delete"
              variant="danger"
            >
              <Trash2 size={18} />
            </IconButton>

            <IconButton
              label="Settings"
              variant="ghost"
            >
              <Settings size={18} />
            </IconButton>

            <IconButton
              label="Small button"
              size="sm"
            >
              <CheckCircle2 size={15} />
            </IconButton>

            <IconButton
              label="Large button"
              size="lg"
            >
              <Activity size={20} />
            </IconButton>
          </div>
        </Card>

        {/* SUMMARY CARDS */}
        <section className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Summary Cards
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Total Students"
              value={248}
              subtitle="Active students"
              trend="+12 this month"
              icon={<Users size={20} />}
            />

            <SummaryCard
              title="Present Today"
              value={214}
              subtitle="86.3% attendance"
              trend="+4.2% from yesterday"
              icon={<CheckCircle2 size={20} />}
            />

            <SummaryCard
              title="Active Plans"
              value={18}
              subtitle="Training plans"
              icon={<Activity size={20} />}
            />

            <SummaryCard
              title="New Students"
              value={24}
              subtitle="This month"
              trend="+8.5%"
              icon={<UserPlus size={20} />}
            />
          </div>
        </section>

        {/* BADGES */}
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Badges
          </h2>

          <div className="flex flex-wrap gap-3">
            <Badge>
              DEFAULT
            </Badge>

            <Badge variant="success">
              ACTIVE
            </Badge>

            <Badge variant="warning">
              PENDING
            </Badge>

            <Badge variant="danger">
              ABSENT
            </Badge>

            <Badge variant="info">
              PRESENT
            </Badge>
          </div>
        </Card>

        {/* INPUTS */}
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Inputs
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="test-name"
                className="mb-2 block text-xs font-semibold text-(--ink-muted)"
              >
                Student Name
              </label>

              <Input
                id="test-name"
                value={inputValue}
                onChange={(event) =>
                  setInputValue(event.target.value)
                }
                placeholder="Enter student name"
              />
            </div>

            <div>
              <label
                htmlFor="training-level"
                className="mb-2 block text-xs font-semibold text-(--ink-muted)"
              >
                Training Level
              </label>

              <Select
                id="training-level"
                value={selectValue}
                onChange={(event) =>
                  setSelectValue(event.target.value)
                }
              >
                <option value="beginner">
                  Beginner
                </option>

                <option value="intermediate">
                  Intermediate
                </option>

                <option value="advanced">
                  Advanced
                </option>
              </Select>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-(--hover-bg) p-3 text-xs text-(--ink-muted)">
            Input value:{" "}
            <span className="font-semibold text-(--foreground)">
              {inputValue || "Empty"}
            </span>
          </div>

          <div className="mt-2 rounded-xl bg-(--hover-bg) p-3 text-xs text-(--ink-muted)">
            Selected level:{" "}
            <span className="font-semibold text-(--foreground)">
              {selectValue}
            </span>
          </div>
        </Card>

        {/* LOADING */}
        <Card className="mb-6">
          <h2 className="mb-6 text-lg font-bold">
            Loading Spinner
          </h2>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner size="sm" />
              <span className="text-xs text-(--ink-muted)">
                Small
              </span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner size="md" />
              <span className="text-xs text-(--ink-muted)">
                Medium
              </span>
            </div>

            <div className="flex flex-col items-center gap-3">
              <LoadingSpinner
                size="lg"
                text="Loading data..."
              />
              <span className="text-xs text-(--ink-muted)">
                Large
              </span>
            </div>
          </div>
        </Card>

        {/* EMPTY STATE */}
        <section className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Empty State
          </h2>

          <EmptyState
            title="No students found"
            description="There are currently no students matching your search criteria."
            icon={<Users size={22} />}
            action={
              <Button variant="primary">
                <UserPlus size={16} />
                Add Student
              </Button>
            }
          />
        </section>

        {/* ERROR STATE */}
        <section className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Error State
          </h2>

          <ErrorState
            title="Unable to load students"
            message="We couldn't retrieve the student data. Please check your connection and try again."
            action={
              <Button
                variant="outline"
                onClick={handleRefresh}
                loading={loading}
              >
                Try Again
              </Button>
            }
          />
        </section>

        {/* ERROR STATE WITH CUSTOM ICON */}
        <section className="mb-6">
          <ErrorState
            title="Something needs attention"
            message="This is another example of the reusable error component."
            action={
              <Button variant="secondary">
                Fix Issue
              </Button>
            }
          />
        </section>

        {/* MODAL TEST */}
        <Card className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Modal
          </h2>

          <p className="mb-4 text-sm text-(--ink-muted)">
            Click the button below to test the reusable
            modal component.
          </p>

          <Button
            onClick={() => setModalOpen(true)}
          >
            Open Test Modal
          </Button>
        </Card>

        {/* CARD TEST */}
        <section className="mb-6">
          <h2 className="mb-4 text-lg font-bold">
            Card Variants
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <Card padding="sm">
              <h3 className="font-bold">
                Small Padding
              </h3>

              <p className="mt-2 text-xs text-(--ink-muted)">
                Card with small padding.
              </p>
            </Card>

            <Card padding="md">
              <h3 className="font-bold">
                Medium Padding
              </h3>

              <p className="mt-2 text-xs text-(--ink-muted)">
                Card with medium padding.
              </p>
            </Card>

            <Card padding="lg">
              <h3 className="font-bold">
                Large Padding
              </h3>

              <p className="mt-2 text-xs text-(--ink-muted)">
                Card with large padding.
              </p>
            </Card>
          </div>
        </section>

        {/* REFRESH TEST */}
        <Card className="mb-10">
          <h2 className="mb-4 text-lg font-bold">
            Refresh Button
          </h2>

          <div className="flex items-center gap-4">
            <RefreshButton
              onClick={handleRefresh}
              loading={loading}
            />

            <span className="text-sm text-(--ink-muted)">
              {loading
                ? "Refreshing..."
                : "Click refresh to test loading state"}
            </span>
          </div>
        </Card>

      </div>

      {/* MODAL */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Test Modal"
        description="This modal is using the reusable DojoFlow Modal component."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>

            <Button
              variant="primary"
              onClick={() => setModalOpen(false)}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div
            className="
              flex
              items-start
              gap-3
              rounded-xl
              bg-(--hover-bg)
              p-4
            "
          >
            <AlertTriangle
              size={20}
              className="mt-0.5 shrink-0 text-(--gold-dark)"
            />

            <div>
              <p className="text-sm font-semibold">
                Modal is working
              </p>

              <p className="mt-1 text-xs leading-5 text-(--ink-muted)">
                You can close this modal using the X
                button, clicking outside it, pressing
                Escape, or using the buttons below.
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="modal-input"
              className="mb-2 block text-xs font-semibold text-(--ink-muted)"
            >
              Test Input
            </label>

            <Input
              id="modal-input"
              placeholder="Type something..."
            />
          </div>

          <div>
            <label
              htmlFor="modal-select"
              className="mb-2 block text-xs font-semibold text-(--ink-muted)"
            >
              Test Select
            </label>

            <Select id="modal-select">
              <option>
                Option One
              </option>

              <option>
                Option Two
              </option>

              <option>
                Option Three
              </option>
            </Select>
          </div>
        </div>
      </Modal>
    </main>
  );
}