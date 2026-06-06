import test from 'node:test'
import assert from 'node:assert/strict'
import { pathsOverlap, replacePathPrefix } from '../../backend/pathIndexSync.js'

test('replacePathPrefix updates nested file paths under a moved folder', () => {
  assert.equal(
    replacePathPrefix('Group A/Comic A/001/0001.jpg', 'Group A/Comic A', 'Group B/Comic A'),
    'Group B/Comic A/001/0001.jpg'
  )
})

test('replacePathPrefix updates archive base paths without changing entry names', () => {
  assert.equal(
    replacePathPrefix('Group A/Comic A/001.cbz#pages/0001.jpg', 'Group A/Comic A', 'Group B/Comic A'),
    'Group B/Comic A/001.cbz#pages/0001.jpg'
  )
})

test('replacePathPrefix does not update sibling prefixes with similar names', () => {
  assert.equal(
    replacePathPrefix('Group A/Comic ABC/001.jpg', 'Group A/Comic A', 'Group B/Comic A'),
    'Group A/Comic ABC/001.jpg'
  )
})

test('replacePathPrefix normalizes windows separators', () => {
  assert.equal(
    replacePathPrefix('Group A\\Comic A\\001.jpg', 'Group A\\Comic A', 'Group B\\Comic A'),
    'Group B/Comic A/001.jpg'
  )
})

test('pathsOverlap detects same and nested paths', () => {
  assert.equal(pathsOverlap('Group A/Comic A', 'Group A/Comic A'), true)
  assert.equal(pathsOverlap('Group A/Comic A/Chapter 1', 'Group A/Comic A'), true)
  assert.equal(pathsOverlap('Group A/Comic ABC', 'Group A/Comic A'), false)
  assert.equal(pathsOverlap('Group A/Comic A', 'Group B/Comic A'), false)
})
