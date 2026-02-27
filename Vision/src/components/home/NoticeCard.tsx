import type { Notice } from '@/types/notice';

interface NoticeCardProps {
    notice: Notice;
    index: number;
}

export function NoticeCard({ notice, index }: NoticeCardProps) {
    return (
        <a
            href={notice.link}
            target="_blank"
            rel="noopener noreferrer"
            className="notice-card"
            style={{ animationDelay: `${index * 40}ms` }}
        >
            <div className="notice-kicker">
                {notice.campus} / {notice.department_name}
            </div>
            <div className="notice-title line-clamp-2">
                {notice.title}
            </div>
            <div className="notice-tags">
                <span className="tag tag-accent">{notice.board_name}</span>
                <span className="tag tag-teal">{notice.college}</span>
            </div>
            <div className="notice-footer">
                <span className="notice-date">{notice.date || 'Date Unknown'}</span>
                <span className="notice-link">View Details</span>
            </div>
        </a>
    );
}
