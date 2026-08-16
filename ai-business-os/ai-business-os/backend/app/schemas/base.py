"""Shared Pydantic base for API schemas.

Snake_case in Python, camelCase on the wire via explicit Field aliases
(same convention as auth / PageMeta).
"""

from pydantic import BaseModel, ConfigDict


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
