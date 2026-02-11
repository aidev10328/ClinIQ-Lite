'use client';

import { useState } from 'react';
import type { QueueEntry, QueueStatus } from '../../lib/api';
import { issueQueueToken } from '../../lib/api';

type QueueCardProps = {
  entry: QueueEntry;
  onStatusChange: (entry: QueueEntry, newStatus: QueueStatus) => void;
};

const PRIORITY_STYLES = {
  NORMAL: '',
  URGENT: 'border-l-4 border-l-orange-500',
  EMERGENCY: 'border-l-4 border-l-red-500',
};

const PRIORITY_BADGES = {
  NORMAL: null,
  URGENT: (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
      Urgent
    </span>
  ),
  EMERGENCY: (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
      Emergency
    </span>
  ),
};

const SOURCE_BADGE = {
  WALKIN: (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
      Walk-in
    </span>
  ),
  APPOINTMENT: null,
};

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function QueueCard({ entry, onStatusChange }: QueueCardProps) {
  const [sendingLink, setSendingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleSendLink = async () => {
    setSendingLink(true);
    try {
      const { data, error } = await issueQueueToken(entry.id);
      if (error) {
        alert(error.message || 'Failed to generate link');
        return;
      }
      if (data) {
        const link = `${window.location.origin}${data.urlPath}`;
        await navigator.clipboard.writeText(link);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    } catch (e) {
      alert('Failed to generate link');
    } finally {
      setSendingLink(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm(`Cancel queue entry for ${entry.patient.fullName}?`)) {
      onStatusChange(entry, 'CANCELLED');
    }
  };

  const handleNoShow = () => {
    if (window.confirm(`Mark ${entry.patient.fullName} as No Show?`)) {
      onStatusChange(entry, 'CANCELLED');
    }
  };

  const renderActions = () => {
    switch (entry.status) {
      case 'QUEUED':
        return (
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex gap-1.5">
              <button
                onClick={() => onStatusChange(entry, 'WAITING')}
                className="flex-1 text-xs py-1.5 px-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors font-medium"
              >
                Move to Waiting
              </button>
              <button
                onClick={handleCancel}
                className="text-xs py-1.5 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
            <button
              onClick={handleSendLink}
              disabled={sendingLink}
              className="w-full text-xs py-1.5 px-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors font-medium disabled:opacity-50"
            >
              {sendingLink ? 'Generating...' : linkCopied ? 'Link Copied!' : 'Send Status Link'}
            </button>
          </div>
        );
      case 'WAITING':
        return (
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex gap-1.5">
              <button
                onClick={() => onStatusChange(entry, 'WITH_DOCTOR')}
                className="flex-1 text-xs py-1.5 px-2 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors font-medium"
              >
                Start Visit
              </button>
              <button
                onClick={handleNoShow}
                className="text-xs py-1.5 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
              >
                No Show
              </button>
            </div>
            <button
              onClick={handleSendLink}
              disabled={sendingLink}
              className="w-full text-xs py-1.5 px-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors font-medium disabled:opacity-50"
            >
              {sendingLink ? 'Generating...' : linkCopied ? 'Link Copied!' : 'Send Status Link'}
            </button>
          </div>
        );
      case 'WITH_DOCTOR':
        return (
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={() => onStatusChange(entry, 'COMPLETED')}
              className="flex-1 text-xs py-1.5 px-2 bg-primary-50 text-primary-700 rounded-md hover:bg-primary-100 transition-colors font-medium"
            >
              Complete Visit
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm ${PRIORITY_STYLES[entry.priority]}`}>
      <div className="flex items-start gap-3">
        {/* Circle badge for queue number */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
          <span className="text-sm font-bold text-primary-700">
            {entry.position}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {entry.patient.fullName}
            </span>
            {PRIORITY_BADGES[entry.priority]}
            {SOURCE_BADGE[entry.source]}
          </div>
          {entry.patient.phone && (
            <div className="text-xs text-gray-500">
              {entry.patient.phone}
            </div>
          )}
          <div className="text-xs text-gray-400 mt-0.5">
            {entry.checkedInAt && `In: ${formatTime(entry.checkedInAt)}`}
            {entry.startedAt && ` | Started: ${formatTime(entry.startedAt)}`}
          </div>
        </div>
      </div>
      {renderActions()}
    </div>
  );
}
