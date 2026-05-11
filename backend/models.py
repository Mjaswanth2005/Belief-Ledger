"""SQLAlchemy models for the Belief Ledger."""
from sqlalchemy import Column, String, Integer, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Entry(Base):
    __tablename__ = "entries"
    id = Column(String(36), primary_key=True)
    text = Column(Text, nullable=False)
    created_at = Column(String(40), nullable=False, index=True)


class Belief(Base):
    __tablename__ = "beliefs"
    id = Column(String(36), primary_key=True)
    short_id = Column(String(20), nullable=False, unique=True, index=True)
    statement = Column(Text, nullable=False)
    confidence = Column(Integer, nullable=False)
    topic = Column(String(60), nullable=False, index=True)
    evidence = Column(JSONB, nullable=False, default=list)
    assumptions = Column(JSONB, nullable=False, default=list)
    cruxes = Column(JSONB, nullable=True)
    cruxes_at = Column(String(40), nullable=True)
    created_at = Column(String(40), nullable=False)
    updated_at = Column(String(40), nullable=False, index=True)
    revisions = Column(Integer, nullable=False, default=1)
    source_entry_id = Column(String(36), nullable=True)


class Dependency(Base):
    __tablename__ = "dependencies"
    id = Column(String(36), primary_key=True)
    dependent = Column(String(36), ForeignKey("beliefs.id", ondelete="CASCADE"), nullable=False, index=True)
    depends_on = Column(String(36), ForeignKey("beliefs.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(20), nullable=False, index=True)
    created_at = Column(String(40), nullable=False)


class Revision(Base):
    __tablename__ = "revisions"
    id = Column(String(36), primary_key=True)
    belief_id = Column(String(36), ForeignKey("beliefs.id", ondelete="CASCADE"), nullable=False, index=True)
    short_id = Column(String(20), nullable=False)
    kind = Column(String(30), nullable=False)
    summary = Column(Text, nullable=False)
    prev_confidence = Column(Integer, nullable=True)
    new_confidence = Column(Integer, nullable=True)
    related_belief_id = Column(String(36), nullable=True)
    created_at = Column(String(40), nullable=False, index=True)


Index("ix_dependencies_dependent_kind", Dependency.dependent, Dependency.kind)
Index("ix_dependencies_depends_on_kind", Dependency.depends_on, Dependency.kind)
